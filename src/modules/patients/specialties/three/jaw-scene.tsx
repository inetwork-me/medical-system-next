"use client"

/* three.js scenes mutate scene-graph objects (materials, rotations, visibility) in effects and the frame loop — the
   normal React Three Fiber pattern — which the React Compiler lint rules can't model. The compiler isn't enabled. */
/* eslint-disable react-hooks/immutability */

import * as React from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { Html, OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"

import { DENTITION_ROWS, type DentalChart } from "../data"
import { Lights, type ViewerApi } from "./eye-scene"
import { proceduralJaw, type JawModelSource, type ToothMesh } from "./model"

/**
 * Live jaw viewer. Teeth in FDI order along the arches (patient's right on the viewer's left), crown surfaces coloured from
 * the chart (decay / existing / done), planned crown and root-canal marks, tap a tooth to select it (same selection as the
 * 2D chart and the Tooth Panel), view presets animate the camera, Gums / Roots / Plan colours toggle layers.
 */

export type JawPreset = "front" | "right" | "left" | "upper" | "lower"
export type JawSceneProps = {
  chart: DentalChart
  selected: number | null
  onSelect?: (fdi: number) => void
  preset: JawPreset
  layers: { gums: boolean; roots: boolean; plan: boolean }
  callout?: { title: string; text: string } | null
  onReady?: () => void
  apiRef?: React.Ref<ViewerApi>
  source?: JawModelSource
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const PRESET: Record<JawPreset, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  front: { pos: V(0, 0.6, 11.5), target: V(0, 0, 0.3) },
  right: { pos: V(-10.5, 0.8, 4.5), target: V(0, 0, 0) },
  left: { pos: V(10.5, 0.8, 4.5), target: V(0, 0, 0) },
  upper: { pos: V(0, -9.5, 2.8), target: V(0, 1, 0.2) },
  lower: { pos: V(0, 9.5, 2.8), target: V(0, -1, 0.2) },
}

function Jaw(p: JawSceneProps) {
  const source = p.source ?? proceduralJaw
  const all = React.useMemo(() => [...DENTITION_ROWS.permanent.upper.flat(), ...DENTITION_ROWS.permanent.lower.flat()], [])
  const teeth = React.useMemo(
    () => all.map((fdi) => source.createTooth(fdi, p.chart.teeth[fdi], p.layers.plan)).filter((x): x is ToothMesh => !!x),
    [all, source, p.chart.teeth, p.layers.plan],
  )
  const gums = React.useMemo(() => source.createGums(), [source])

  React.useEffect(() => {
    for (const t of teeth) {
      const m = t.crown.material as THREE.MeshPhysicalMaterial
      m.emissive.set(t.fdi === p.selected ? "#2B6BFF" : "#000000")
      m.emissiveIntensity = t.fdi === p.selected ? 0.45 : 0
      t.roots.visible = p.layers.roots
      t.marks.children.forEach((c) => {
        // root-canal line sits in the root: only with roots shown
        if ((c as THREE.Mesh).geometry instanceof THREE.CylinderGeometry) c.visible = p.layers.roots
      })
      const upper = Math.floor(t.fdi / 10) % 4 === 1 || Math.floor(t.fdi / 10) % 4 === 2
      t.group.visible = !(p.preset === "upper" && !upper) && !(p.preset === "lower" && upper)
    }
    for (const g of gums.children as THREE.Mesh[]) {
      const mat = g.material as THREE.MeshPhysicalMaterial
      mat.opacity = p.layers.roots ? 0.35 : 1
      mat.depthWrite = !p.layers.roots
      const upper = g.name === "gum_upper"
      g.visible = p.layers.gums && !(p.preset === "upper" && !upper) && !(p.preset === "lower" && upper)
    }
  }, [teeth, gums, p.selected, p.layers, p.preset])

  const sel = teeth.find((t) => t.fdi === p.selected)
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!p.onSelect) return
    let o: THREE.Object3D | null = e.object
    while (o && o.userData.fdi == null) o = o.parent
    const fdi = o?.userData.fdi as number | undefined
    if (fdi) {
      e.stopPropagation()
      p.onSelect(fdi)
    }
  }
  return (
    <>
      <group onClick={click} onPointerOver={() => p.onSelect && (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
        {teeth.map((t) => (
          <primitive key={`${t.fdi}-${p.layers.plan}`} object={t.group} />
        ))}
      </group>
      <primitive object={gums} />
      {sel && p.callout && p.preset !== "upper" && p.preset !== "lower" && (
        <Html position={sel.anchor.toArray()} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          {/* Shifted towards the midline so callouts on back teeth stay inside narrow viewports. */}
          <div
            className={`w-max max-w-[min(16rem,42vw)] -translate-y-8 rounded-[10px] border border-[#2B6BFF] bg-slate-900/90 px-3 py-2 text-xs ${
              sel.anchor.x > 0.5 ? "-translate-x-[35%]" : sel.anchor.x < -0.5 ? "translate-x-[35%]" : ""
            }`}
          >
            <div className="font-medium text-[#93C5FD]">{p.callout.title}</div>
            <div className="text-slate-200">{p.callout.text}</div>
          </div>
        </Html>
      )}
    </>
  )
}

/** Camera: animates to the preset, then hands over to OrbitControls. Toolbar API: zoom, reset, auto-rotate. */
function Rig({ preset, apiRef }: { preset: JawPreset; apiRef?: React.Ref<ViewerApi> }) {
  const ref = React.useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const goal = React.useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  React.useEffect(() => {
    goal.current = { pos: PRESET[preset].pos.clone(), target: PRESET[preset].target.clone() }
  }, [preset])
  useFrame((_, dt) => {
    const g = goal.current
    const c = ref.current
    if (!g || !c) return
    const k = 1 - Math.exp(-5 * dt)
    camera.position.lerp(g.pos, k)
    c.target.lerp(g.target, k)
    c.update()
    if (camera.position.distanceTo(g.pos) < 0.02) goal.current = null
  })
  React.useImperativeHandle(
    apiRef,
    () => ({
      zoomIn: () => {
        const c = ref.current
        if (c) goal.current = { pos: camera.position.clone().lerp(c.target, 0.22), target: c.target.clone() }
      },
      zoomOut: () => {
        const c = ref.current
        if (c) goal.current = { pos: camera.position.clone().sub(c.target).multiplyScalar(1.28).add(c.target), target: c.target.clone() }
      },
      reset: () => {
        if (ref.current) ref.current.autoRotate = false
        goal.current = { pos: PRESET.front.pos.clone(), target: PRESET.front.target.clone() }
      },
      toggleRotate: () => {
        if (ref.current) ref.current.autoRotate = !ref.current.autoRotate
      },
    }),
    [camera],
  )
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={PRESET.front.target}
      enablePan={false}
      minDistance={5}
      maxDistance={20}
      autoRotateSpeed={1.2}
      onStart={() => (goal.current = null)}
    />
  )
}

export default function JawScene(p: JawSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: PRESET.front.pos.toArray(), fov: 32 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={() => p.onReady?.()}
      style={{ position: "absolute", inset: 0 }}
    >
      <Lights />
      <Jaw {...p} />
      <Rig preset={p.preset} apiRef={p.apiRef} />
    </Canvas>
  )
}
