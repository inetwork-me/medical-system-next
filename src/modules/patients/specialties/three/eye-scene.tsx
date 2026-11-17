"use client"

/* three.js scenes mutate scene-graph objects (materials, rotations, visibility) in effects and the frame loop — the
   normal React Three Fiber pattern — which the React Compiler lint rules can't model. The compiler isn't enabled. */
/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, react-hooks/use-memo */

import * as React from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"

import type { Eye, Gaze, Grades, MuscleKey } from "../data"
import { MUSCLE_COLOR, lateralSign, proceduralEyes, reachOf, type EyeModelSource, type EyeRig } from "./model"

/**
 * Live eye viewer (React Three Fiber). The gaze pad and angle set a target per eye; each muscle grade scales how far the
 * eye can turn in that muscle's direction (LR −3 → abduction reaches ~36 %) and a weak LR / MR leaves a primary-gaze
 * deviation (esotropia / exotropia). "Move both eyes together" off moves only the picked eye. Scene: viewer faces the
 * patient (OD on the viewer's left), never mirrored.
 */

export type ViewerApi = { zoomIn: () => void; zoomOut: () => void; reset: () => void; toggleRotate: () => void }
export type EyeSceneProps = {
  grades: Grades
  gaze: Gaze
  angle: number
  eye?: "both" | Eye
  together?: boolean
  showMuscles?: boolean
  showLines?: boolean
  /** Anatomy: highlighted muscle + its eye. */
  selected?: MuscleKey | null
  selectedEye?: Eye
  mode: "exam" | "anatomy" | "compact" | "patient"
  onSelectMuscle?: (m: MuscleKey) => void
  onReady?: () => void
  apiRef?: React.Ref<ViewerApi>
  source?: EyeModelSource
}

const DIR: Record<Gaze, [number, number]> = {
  upR: [-1, 1],
  up: [0, 1],
  upL: [1, 1],
  right: [-1, 0],
  primary: [0, 0],
  left: [1, 0],
  downR: [-1, -1],
  down: [0, -1],
  downL: [1, -1],
}
const CAM = {
  front: { pos: new THREE.Vector3(0, 0.5, 9.5), target: new THREE.Vector3(0, 0, -0.6) },
  anatomy: { pos: new THREE.Vector3(-5.6, 2, 4.4), target: new THREE.Vector3(0, 0, -1) },
}
const deg = THREE.MathUtils.degToRad

/** Target yaw / pitch (radians) for one eye. */
function targetFor(eye: Eye, g: Grades, gaze: Gaze, angle: number, moves: boolean) {
  const L = lateralSign(eye)
  const gr = g[eye]
  const [h, vv] = moves ? DIR[gaze] : [0, 0]
  const a = h && vv ? angle * 0.75 : angle
  let hx = h * a
  if (h * L > 0) hx *= reachOf(gr.LR)
  else if (h * L < 0) hx *= reachOf(gr.MR)
  let vy = vv * a
  if (vv > 0) vy *= Math.min(reachOf(gr.SR), reachOf(gr.IO))
  else if (vv < 0) vy *= Math.min(reachOf(gr.IR), reachOf(gr.SO))
  // Weak LR → the eye drifts in (towards the nose, −L); weak MR → out.
  const eso = (1 - Math.min(1, reachOf(gr.LR))) * 14
  const exo = (1 - Math.min(1, reachOf(gr.MR))) * 14
  const yaw = hx + -L * eso + L * exo
  return { yaw: deg(yaw), pitch: deg(-vy) }
}

function muscleColor(grade: number, selected: boolean) {
  return selected ? MUSCLE_COLOR.selected : grade < 0 ? MUSCLE_COLOR.under : grade > 0 ? MUSCLE_COLOR.over : MUSCLE_COLOR.normal
}

function Eyes(p: EyeSceneProps) {
  const source = p.source ?? proceduralEyes
  const eyes: Eye[] = p.mode === "anatomy" ? [p.selectedEye ?? "OD"] : ["OD", "OS"]
  const rigs = React.useMemo(() => {
    const out = {} as Record<Eye, EyeRig & { line: THREE.Mesh }>
    for (const e of eyes) {
      const rig = source.createEye(e)
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 6, 6).rotateX(Math.PI / 2).translate(0, 0, 4), new THREE.MeshBasicMaterial({ color: "#60A5FA" }))
      rig.globe.add(line)
      out[e] = { ...rig, line }
    }
    return out
  }, [source, eyes.join()])

  // Colours, visibility.
  React.useEffect(() => {
    for (const e of eyes) {
      const r = rigs[e]
      for (const k of Object.keys(r.muscles) as MuscleKey[]) {
        const m = r.muscles[k]
        ;(m.material as THREE.MeshStandardMaterial).color.set(muscleColor(p.grades[e][k], p.mode === "anatomy" && p.selected === k))
        m.visible = p.showMuscles !== false
      }
      r.line.visible = !!p.showLines
    }
  })

  useFrame((_, dt) => {
    for (const e of eyes) {
      const moves = p.mode === "anatomy" || p.together !== false || p.eye === "both" || p.eye === e
      const t = targetFor(e, p.grades, p.gaze, p.angle, moves)
      const g = rigs[e].globe
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, t.yaw, 6, dt)
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, t.pitch, 6, dt)
    }
  })

  return (
    <>
      {eyes.map((e) => (
        <group key={e} position={[p.mode === "anatomy" ? 0 : e === "OD" ? -1.3 : 1.3, 0, 0]}>
          <primitive object={rigs[e].globe} />
          <primitive
            object={rigs[e].orbit}
            onClick={
              p.onSelectMuscle
                ? (ev: { stopPropagation: () => void; object: THREE.Object3D }) => {
                    ev.stopPropagation()
                    const k = ev.object.userData.muscle as MuscleKey | undefined
                    if (k) p.onSelectMuscle!(k)
                  }
                : undefined
            }
            onPointerOver={p.onSelectMuscle ? () => (document.body.style.cursor = "pointer") : undefined}
            onPointerOut={p.onSelectMuscle ? () => (document.body.style.cursor = "") : undefined}
          />
        </group>
      ))}
    </>
  )
}

/** OrbitControls + the toolbar API (zoom, reset, auto-rotate). */
export function Controls({
  home: base,
  apiRef,
  enabled = true,
  fitAspect = 1.35,
}: {
  home: { pos: THREE.Vector3; target: THREE.Vector3 }
  apiRef?: React.Ref<ViewerApi>
  enabled?: boolean
  /** Narrower viewports (portrait desktop column, phones) back the camera off so the scene keeps its width. */
  fitAspect?: number
}) {
  const ref = React.useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const home = React.useMemo(() => {
    const k = Math.max(1, fitAspect / aspect)
    return { pos: base.target.clone().add(base.pos.clone().sub(base.target).multiplyScalar(k)), target: base.target }
  }, [base, aspect, fitAspect])
  React.useEffect(() => {
    camera.position.copy(home.pos)
    ref.current?.target.copy(home.target)
    ref.current?.update()
  }, [camera, home])
  React.useImperativeHandle(
    apiRef,
    () => ({
      zoomIn: () => {
        const c = ref.current
        if (c) camera.position.lerp(c.target, 0.2)
      },
      zoomOut: () => {
        const c = ref.current
        if (c) camera.position.sub(c.target).multiplyScalar(1.25).add(c.target)
      },
      reset: () => {
        camera.position.copy(home.pos)
        ref.current?.target.copy(home.target)
        if (ref.current) ref.current.autoRotate = false
      },
      toggleRotate: () => {
        if (ref.current) ref.current.autoRotate = !ref.current.autoRotate
      },
    }),
    [camera, home],
  )
  return <OrbitControls ref={ref} makeDefault target={home.target} enabled={enabled} enablePan={false} minDistance={4} maxDistance={30} autoRotateSpeed={1.5} />
}

export function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 7]} intensity={1.6} />
      <directionalLight position={[-5, -2, 3]} intensity={0.5} color="#bcd0ff" />
      <pointLight position={[0, 0, 6]} intensity={8} distance={14} />
    </>
  )
}

export default function EyeScene(p: EyeSceneProps) {
  const home = p.mode === "anatomy" ? CAM.anatomy : CAM.front
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: home.pos.toArray(), fov: p.mode === "compact" ? 34 : 30 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={() => p.onReady?.()}
      style={{ position: "absolute", inset: 0 }}
    >
      <Lights />
      <Eyes {...p} />
      <Controls home={home} apiRef={p.apiRef} enabled={p.mode !== "compact"} fitAspect={p.mode === "anatomy" ? 1.1 : p.mode === "patient" ? 1.0 : 1.6} />
    </Canvas>
  )
}
