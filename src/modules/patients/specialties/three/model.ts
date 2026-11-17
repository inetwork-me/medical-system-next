import * as THREE from "three"

import { isUpper, toothType, type Eye, type MuscleKey, type Surface, type SurfaceState, type ToothRecord } from "../data"

/**
 * 3D models behind a swappable source. Today: procedural geometry (the same approach as the design renders).
 * Later: licensed / commissioned GLBs — one mesh per extra-ocular muscle and one per FDI tooth — loaded by name
 * ("OD_LR", "tooth_36"…) into the same shapes, so the scenes don't change.
 *
 * Scene frame: the viewer faces the patient (camera on +z). The patient's right is the viewer's left (−x), in both languages.
 */

/* ================================================================== eyes */

export type EyeRig = {
  /** Rotates with the gaze (globe, iris, cornea). */
  globe: THREE.Group
  /** Static in the orbit: the six muscles + optic nerve. */
  orbit: THREE.Group
  muscles: Record<MuscleKey, THREE.Mesh>
}

export interface EyeModelSource {
  id: string
  createEye(eye: Eye): EyeRig
}

/** Lateral side of an eye along x: the right eye's lateral (temporal) side is the patient's right = viewer's left. */
export const lateralSign = (eye: Eye) => (eye === "OD" ? -1 : 1)

let irisTexture: THREE.CanvasTexture | null = null
/** Iris as a vertical gradient: the cap's v runs from the centre (pupil, canvas top) to the limbus (bottom). */
function iris() {
  if (irisTexture) return irisTexture
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, "#050505")
  grad.addColorStop(0.36, "#050505")
  grad.addColorStop(0.38, "#3b2108")
  grad.addColorStop(0.6, "#8a5418")
  grad.addColorStop(0.86, "#6b3f10")
  grad.addColorStop(0.95, "#2a1606")
  grad.addColorStop(1, "#f1ede4")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  // radial fibres (vertical lines in the cap's UV space)
  for (let x = 0; x < 256; x += 3) {
    g.strokeStyle = `rgba(${200 + ((x * 7) % 40)},${140 + ((x * 13) % 40)},60,${0.12 + ((x * 11) % 10) / 60})`
    g.beginPath()
    g.moveTo(x, 100)
    g.lineTo(x + ((x * 5) % 7) - 3, 236)
    g.stroke()
  }
  irisTexture = new THREE.CanvasTexture(c)
  irisTexture.colorSpace = THREE.SRGBColorSpace
  return irisTexture
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const onSphere = (x: number, y: number, z: number, r = 1.04) => v(x, y, z).normalize().multiplyScalar(r)

/** Muscle paths (insertion on the globe → around it → the orbit apex), for a lateral sign L. */
function musclePaths(L: number): Record<MuscleKey, THREE.Vector3[]> {
  const apex = (dx: number, dy: number) => v(-L * 0.15 + dx, dy, -3.1)
  return {
    LR: [onSphere(L * 0.87, 0, 0.5), onSphere(L, 0, -0.05), onSphere(L * 0.8, 0, -0.6, 1.1), apex(L * 0.18, 0)],
    MR: [onSphere(-L * 0.87, 0, 0.5), onSphere(-L, 0, -0.05), onSphere(-L * 0.8, 0, -0.6, 1.1), apex(-L * 0.12, 0)],
    SR: [onSphere(0, 0.87, 0.5), onSphere(0, 1, -0.05), onSphere(0, 0.8, -0.6, 1.1), apex(0, 0.18)],
    IR: [onSphere(0, -0.87, 0.5), onSphere(0, -1, -0.05), onSphere(0, -0.8, -0.6, 1.1), apex(0, -0.18)],
    SO: [onSphere(L * 0.45, 0.75, -0.45), onSphere(-L * 0.15, 1, 0.1), v(-L * 0.95, 1.0, 0.75), v(-L * 0.6, 0.55, -1.4), apex(-L * 0.08, 0.12)],
    IO: [onSphere(L * 0.55, -0.62, -0.5), onSphere(L * 0.05, -1, 0.15), v(-L * 0.6, -1.0, 0.55), v(-L * 0.95, -0.85, 0.75)],
  }
}

export const MUSCLE_COLOR = { normal: "#C0605C", under: "#F59E0B", over: "#8B5CF6", selected: "#2B6BFF" }

/** Procedural eye: sclera sphere, iris + pupil cap, clear cornea, flattened muscle ribbons, optic nerve. */
export const proceduralEyes: EyeModelSource = {
  id: "procedural-eyes-v1",
  createEye(eye) {
    const L = lateralSign(eye)
    const globe = new THREE.Group()
    globe.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 32),
        new THREE.MeshPhysicalMaterial({ color: "#f4f1ea", roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      ),
    )
    const cap = new THREE.SphereGeometry(1.004, 64, 12, 0, Math.PI * 2, 0, 0.44)
    cap.rotateX(Math.PI / 2)
    globe.add(new THREE.Mesh(cap, new THREE.MeshStandardMaterial({ map: iris(), roughness: 0.45 })))
    const cornea = new THREE.SphereGeometry(1.06, 48, 12, 0, Math.PI * 2, 0, 0.5)
    cornea.rotateX(Math.PI / 2)
    globe.add(
      new THREE.Mesh(
        cornea,
        new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.12, roughness: 0, clearcoat: 1, transmission: 0.6 }),
      ),
    )

    const orbit = new THREE.Group()
    const paths = musclePaths(L)
    const muscles = {} as Record<MuscleKey, THREE.Mesh>
    for (const k of Object.keys(paths) as MuscleKey[]) {
      const curve = new THREE.CatmullRomCurve3(paths[k])
      const geo = new THREE.TubeGeometry(curve, 48, 0.11, 8, false)
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: MUSCLE_COLOR.normal, roughness: 0.55 }))
      mesh.name = `${eye}_${k}`
      mesh.userData.muscle = k
      muscles[k] = mesh
      orbit.add(mesh)
    }
    const nerve = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v(0, 0, -0.95), v(-L * 0.08, 0, -2), v(-L * 0.15, 0, -3.2)]), 24, 0.2, 12, false)
    orbit.add(new THREE.Mesh(nerve, new THREE.MeshStandardMaterial({ color: "#e8dcc0", roughness: 0.7 })))
    return { globe, orbit, muscles }
  },
}

/** −4…+4 → how much of the full movement that muscle allows (LR −3 → abduction reaches about 36 %). */
export const reachOf = (grade: number) => (grade < 0 ? Math.max(0.08, 1 + 0.213 * grade) : 1 + 0.06 * grade)

/* ================================================================== teeth */

export type ToothMesh = { fdi: number; group: THREE.Group; crown: THREE.Mesh; roots: THREE.Group; marks: THREE.Group; anchor: THREE.Vector3 }

export interface JawModelSource {
  id: string
  /** One group per FDI tooth (crown with per-surface vertex colours, roots, planned marks). */
  createTooth(fdi: number, rec: ToothRecord | undefined, colours: boolean): ToothMesh | null
  /** Gum ribbons for both arches. */
  createGums(): THREE.Group
  /** World position of a tooth (for callouts / camera). */
  place(fdi: number): { position: THREE.Vector3; basis: THREE.Matrix4; mesialSign: number }
}

const ENAMEL = new THREE.Color("#f1ede4")
export const STATE_COLOR: Record<SurfaceState, THREE.Color> = {
  decay: new THREE.Color("#E11D2E"),
  existing: new THREE.Color("#2B6BFF"),
  done: new THREE.Color("#16A34A"),
}
const WIDTH: Record<number, number> = { 1: 0.86, 2: 0.7, 3: 0.8, 4: 0.72, 5: 0.7, 6: 1.02, 7: 0.96, 8: 0.9 }
const HEIGHT: Record<string, number> = { incisor: 0.95, canine: 1.05, premolar: 0.85, molar: 0.75 }
const ARCH_Y = 1.05

/** Patient's-right half arch (x < 0), from the midline backwards. */
function halfArch(scale: number) {
  return new THREE.CatmullRomCurve3([v(0, 0, 2.3), v(-1.05, 0, 2.02), v(-1.95, 0, 1.25), v(-2.45, 0, 0.1), v(-2.65, 0, -1.3)].map((p) => p.multiplyScalar(scale)))
}

function placeTooth(fdi: number) {
  const q = Math.floor(fdi / 10)
  const pos = fdi % 10
  const up = isUpper(fdi)
  const right = [1, 4, 5, 8].includes(q)
  const curve = halfArch(up ? 1.05 : 0.98)
  const len = curve.getLength()
  let s = 0
  for (let i = 1; i < pos; i++) s += WIDTH[i] + 0.03
  s += WIDTH[pos] / 2
  const u = Math.min(0.999, s / len)
  const p = curve.getPointAt(u)
  const t = curve.getTangentAt(u)
  if (!right) {
    p.x = -p.x
    t.x = -t.x
  }
  p.y = up ? ARCH_Y : -ARCH_Y
  const mesial = t.clone().multiplyScalar(-1).setY(0).normalize()
  const occlusal = v(0, up ? -1 : 1, 0)
  // Right-handed frame (a rotation): y = occlusal, z = outward (buccal), x = y × z. Mesial is ±x — remembered so the
  // M / D surface colours land on the side that faces the midline.
  let outward = new THREE.Vector3().crossVectors(mesial, occlusal).normalize()
  if (outward.dot(v(p.x, 0, p.z - 0.2)) < 0) outward = outward.multiplyScalar(-1)
  const x = new THREE.Vector3().crossVectors(occlusal, outward).normalize()
  const mesialSign = x.dot(mesial) >= 0 ? 1 : -1
  return { position: p, basis: new THREE.Matrix4().makeBasis(x, occlusal, outward), mesialSign }
}

/** Crown as a lathe (rotationally symmetric, then squashed): flat-topped molars, blade-like incisors, pointed canines. */
function crownGeometry(type: string, w: number) {
  const h = HEIGHT[type]
  const pts =
    type === "canine"
      ? [v(0.3, 0, 0), v(0.46, 0.3 * h, 0), v(0.44, 0.65 * h, 0), v(0.22, 0.9 * h, 0), v(0.02, h, 0)]
      : type === "incisor"
        ? [v(0.3, 0, 0), v(0.45, 0.3 * h, 0), v(0.48, 0.7 * h, 0), v(0.4, 0.94 * h, 0), v(0.02, h, 0)]
        : [v(0.36, 0, 0), v(0.5, 0.3 * h, 0), v(0.52, 0.65 * h, 0), v(0.44, 0.92 * h, 0), v(0.25, h, 0), v(0.02, 0.9 * h, 0)]
  const geo = new THREE.LatheGeometry(
    pts.map((p) => new THREE.Vector2(p.x, p.y)),
    24,
  )
  const depth = type === "incisor" ? 0.55 : type === "canine" ? 0.75 : 1
  geo.scale(w, 1, w * depth)
  geo.computeVertexNormals()
  return geo
}

/** Per-vertex surface colours in the tooth frame: +y occlusal, ±x mesial (mesialSign), +z buccal. */
function paintSurfaces(geo: THREE.BufferGeometry, surfaces: Partial<Record<Surface, SurfaceState>> | undefined, mesialSign: number) {
  const n = geo.attributes.normal
  const pos = geo.attributes.position
  const col = new Float32Array(n.count * 3)
  const ymax = geo.boundingBox?.max.y ?? (geo.computeBoundingBox(), geo.boundingBox!.max.y)
  for (let i = 0; i < n.count; i++) {
    const nx = n.getX(i)
    const ny = n.getY(i)
    const nz = n.getZ(i)
    const y = pos.getY(i)
    let s: Surface
    if (ny > 0.55 || y > ymax * 0.9) s = "O"
    else if (Math.abs(nx) > Math.abs(nz)) s = nx * mesialSign > 0 ? "M" : "D"
    else s = nz > 0 ? "B" : "L"
    const state = surfaces?.[s]
    const c = state ? STATE_COLOR[state] : ENAMEL
    col.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3))
}

export const proceduralJaw: JawModelSource = {
  id: "procedural-jaw-v1",
  place: placeTooth,
  createTooth(fdi, rec, colours) {
    if (rec?.state === "missing") return null
    const type = toothType(fdi)
    const w = WIDTH[fdi % 10] * 0.92
    const group = new THREE.Group()
    group.name = `tooth_${fdi}`
    const { position, basis, mesialSign } = placeTooth(fdi)
    group.position.copy(position)
    group.quaternion.setFromRotationMatrix(basis)
    const unerupted = rec?.state === "unerupted"
    if (unerupted) {
      group.scale.setScalar(0.75)
      group.position.y += isUpper(fdi) ? 0.5 : -0.5
    }
    const geo = crownGeometry(type, w)
    geo.computeBoundingBox()
    paintSurfaces(geo, colours ? rec?.surfaces : undefined, mesialSign)
    const crown = new THREE.Mesh(
      geo,
      new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.5, transparent: unerupted, opacity: unerupted ? 0.55 : 1 }),
    )
    crown.userData.fdi = fdi
    group.add(crown)

    const roots = new THREE.Group()
    const nRoots = type === "molar" ? (isUpper(fdi) ? 3 : 2) : 1
    const rl = type === "canine" ? 1.35 : type === "molar" ? 0.95 : 1.1
    for (let i = 0; i < nRoots; i++) {
      // Tapered root: full width at the neck, rounded-narrow apex.
      const cone = new THREE.CylinderGeometry(nRoots > 1 ? 0.2 * w : 0.3 * w, nRoots > 1 ? 0.07 * w : 0.09 * w, rl, 14)
      cone.translate(0, -rl / 2, 0)
      const r = new THREE.Mesh(cone, new THREE.MeshStandardMaterial({ color: "#e9dfc9", roughness: 0.6 }))
      r.userData.fdi = fdi
      if (nRoots === 2) r.position.x = (i ? 1 : -1) * 0.22 * w
      if (nRoots === 3) r.position.set(i === 2 ? 0 : (i ? 1 : -1) * 0.22 * w, 0, i === 2 ? -0.2 * w : 0.12 * w)
      roots.add(r)
    }
    group.add(roots)

    const marks = new THREE.Group()
    if (colours && rec?.marks?.includes("crown")) {
      const shell = new THREE.Mesh(geo.clone().scale(1.12, 1.06, 1.12), new THREE.MeshBasicMaterial({ color: "#F59E0B", wireframe: true, transparent: true, opacity: 0.7 }))
      marks.add(shell)
    }
    if (colours && rec?.marks?.includes("rootCanal")) {
      const canal = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, rl + 0.5, 8), new THREE.MeshBasicMaterial({ color: "#F59E0B" }))
      canal.position.y = -rl / 2 + 0.3
      marks.add(canal)
    }
    group.add(marks)
    const anchor = position.clone().add(v(0, isUpper(fdi) ? -1.0 : 1.0, 0))
    return { fdi, group, crown, roots, marks, anchor }
  },
  createGums() {
    const g = new THREE.Group()
    for (const up of [true, false]) {
      const half = halfArch(up ? 1.05 : 0.98).getPoints(24)
      const pts = [...half.slice(1).reverse().map((p) => v(p.x, 0, p.z)), ...half.map((p) => v(-p.x, 0, p.z))]
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.5, 16, false)
      tube.scale(1, 0.85, 1)
      const m = new THREE.Mesh(tube, new THREE.MeshPhysicalMaterial({ color: "#e48d94", roughness: 0.45, clearcoat: 0.3, transparent: true, opacity: 1 }))
      m.position.y = up ? ARCH_Y + 0.12 : -ARCH_Y - 0.12
      m.name = up ? "gum_upper" : "gum_lower"
      g.add(m)
    }
    return g
  },
}
