"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import type { EyeSceneProps, ViewerApi } from "./eye-scene"
import type { JawSceneProps } from "./jaw-scene"

/**
 * Client-only entry points for the 3D viewers (three.js is loaded lazily, never on the server). The caller keeps the
 * still render underneath as the loading state; it is hidden once the scene reports ready. Without WebGL nothing is
 * mounted and the still stays — the brief's fallback.
 */

const EyeScene = dynamic(() => import("./eye-scene"), { ssr: false })
const JawScene = dynamic(() => import("./jaw-scene"), { ssr: false })

let webgl: boolean | null = null
function hasWebGL() {
  if (webgl !== null) return webgl
  try {
    const c = document.createElement("canvas")
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    webgl = false
  }
  return webgl
}
const noop = () => () => {}
/** true in a browser with WebGL; false on the server and without WebGL. */
export function useWebGL() {
  return React.useSyncExternalStore(noop, hasWebGL, () => false)
}

export function LiveEye(props: EyeSceneProps) {
  return useWebGL() ? <EyeScene {...props} /> : null
}

export function LiveJaw(props: JawSceneProps) {
  return useWebGL() ? <JawScene {...props} /> : null
}

export type { ViewerApi }
