/**
 * Zenboard — Gesture Camera Nav
 * =============================
 * A Framer code component that turns on the visitor's camera and converts hand
 * movements into navigation actions (next slide, previous slide, play/pause…).
 *
 * Everything runs on-device in the browser using MediaPipe Tasks Vision.
 * No video, image or landmark data ever leaves the visitor's machine.
 *
 * HOW TO USE IN FRAMER
 * --------------------
 *  1. Framer → Assets → Code → New Code File → paste this whole file.
 *  2. Drag the component onto your page (a corner overlay works well).
 *  3. Pick how it should drive your slider in the "Output" section:
 *       • Framer Events  → wire onNext / onPrev in the Interactions panel.
 *       • Click Target   → give a CSS selector for your slider's arrows.
 *       • Keyboard       → dispatches ArrowRight / ArrowLeft on the page.
 *  4. The camera never starts on the Framer canvas. Test with Preview in a
 *     new browser tab, or on the published site (camera needs HTTPS + a
 *     top-level page, and iframes must allow camera access).
 *
 * DEFAULT GESTURES
 * ----------------
 *   Swipe hand left  → Next          Swipe hand right → Previous
 *   Open palm ✋ hold → Play / pause   Fist ✊ hold      → Previous
 *   Victory ✌️ hold  → Next          Pinch 👌         → Select
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 320
 * @framerIntrinsicHeight 240
 */

import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/* ------------------------------------------------------------------ *
 * Design tokens
 * Local mirror of the Zenboard design system so the component stays
 * self-contained inside Framer while remaining visually consistent.
 * ------------------------------------------------------------------ */

const T = {
    space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
    radius: { sm: 8, md: 12, lg: 16, xl: 20, full: 999 },
    shadow: {
        medium: "0 4px 16px rgba(0,0,0,0.18)",
        floating: "0 12px 40px rgba(0,0,0,0.28)",
    },
    duration: { fast: 120, base: 200, slow: 320 },
    ease: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
        exit: "cubic-bezier(0.4, 0, 1, 1)",
    },
    type: {
        h4: { fontSize: 15, lineHeight: "20px", fontWeight: 600, letterSpacing: "-0.01em" },
        body: { fontSize: 13, lineHeight: "18px", fontWeight: 500, letterSpacing: "0em" },
        label: { fontSize: 12, lineHeight: "16px", fontWeight: 600, letterSpacing: "0.01em" },
        caption: { fontSize: 11, lineHeight: "15px", fontWeight: 500, letterSpacing: "0.01em" },
    },
    font: `Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
} as const

/* ------------------------------------------------------------------ *
 * MediaPipe loading (CDN, with fallbacks)
 * ------------------------------------------------------------------ */

const MP_VERSION = "0.10.14"

const MODULE_URLS = [
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`,
    `https://unpkg.com/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`,
    `https://esm.sh/@mediapipe/tasks-vision@${MP_VERSION}`,
]

const WASM_BASES = [
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
    `https://unpkg.com/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
]

const DEFAULT_MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"

// `new Function` keeps the URL opaque to the bundler so it stays a real
// runtime browser import instead of being resolved at build time.
const runtimeImport = new Function("u", "return import(u)") as (u: string) => Promise<any>

type Vision = { mod: any; fileset: any }

// The module + wasm runtime are shared by every instance on the page.
let visionCache: Promise<Vision> | null = null

async function loadVision(): Promise<Vision> {
    if (visionCache) return visionCache

    const promise = (async (): Promise<Vision> => {
        let mod: any = null
        let moduleError: unknown = null
        for (const url of MODULE_URLS) {
            try {
                const candidate = await runtimeImport(url)
                if (candidate && candidate.FilesetResolver && candidate.GestureRecognizer) {
                    mod = candidate
                    break
                }
            } catch (err) {
                moduleError = err
            }
        }
        if (!mod) {
            throw new Error(
                `Could not load the hand-tracking library. ${describeError(moduleError)}`
            )
        }

        let fileset: any = null
        let wasmError: unknown = null
        for (const base of WASM_BASES) {
            try {
                fileset = await mod.FilesetResolver.forVisionTasks(base)
                break
            } catch (err) {
                wasmError = err
            }
        }
        if (!fileset) {
            throw new Error(`Could not load the tracking runtime. ${describeError(wasmError)}`)
        }

        return { mod, fileset }
    })()

    // Let a failed load be retried instead of caching the rejection forever.
    promise.catch(() => {
        if (visionCache === promise) visionCache = null
    })

    visionCache = promise
    return promise
}

async function createRecognizer(vision: Vision, modelUrl: string, numHands: number) {
    const build = (delegate: "GPU" | "CPU") =>
        vision.mod.GestureRecognizer.createFromOptions(vision.fileset, {
            baseOptions: { modelAssetPath: modelUrl, delegate },
            runningMode: "VIDEO",
            numHands,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        })

    try {
        return await build("GPU")
    } catch {
        return await build("CPU")
    }
}

function describeError(err: unknown): string {
    if (!err) return "Check the network connection and try again."
    const message = err instanceof Error ? err.message : String(err)
    return message.slice(0, 160)
}

/* ------------------------------------------------------------------ *
 * Gesture + action model
 * ------------------------------------------------------------------ */

type Action =
    | "none"
    | "next"
    | "prev"
    | "first"
    | "last"
    | "playPause"
    | "select"
    | "scrollUp"
    | "scrollDown"

const ACTION_OPTIONS: Action[] = [
    "none",
    "next",
    "prev",
    "first",
    "last",
    "playPause",
    "select",
    "scrollUp",
    "scrollDown",
]

const ACTION_TITLES = [
    "Do nothing",
    "Next",
    "Previous",
    "First",
    "Last",
    "Play / pause",
    "Select",
    "Scroll up",
    "Scroll down",
]

const ACTION_LABEL: Record<Action, string> = {
    none: "",
    next: "Next →",
    prev: "← Previous",
    first: "⇤ First",
    last: "Last ⇥",
    playPause: "Play / pause",
    select: "Select",
    scrollUp: "Scroll up",
    scrollDown: "Scroll down",
}

const ACTION_KEY: Record<Action, { key: string; code: string; keyCode: number } | null> = {
    none: null,
    next: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
    prev: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
    first: { key: "Home", code: "Home", keyCode: 36 },
    last: { key: "End", code: "End", keyCode: 35 },
    playPause: { key: " ", code: "Space", keyCode: 32 },
    select: { key: "Enter", code: "Enter", keyCode: 13 },
    scrollUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
    scrollDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
}

/** Source gestures the recognizer can produce. */
type GestureName =
    | "swipeLeft"
    | "swipeRight"
    | "swipeUp"
    | "swipeDown"
    | "openPalm"
    | "closedFist"
    | "victory"
    | "thumbUp"
    | "thumbDown"
    | "pointUp"
    | "pinch"

const GESTURE_LABEL: Record<GestureName, string> = {
    swipeLeft: "Swipe left",
    swipeRight: "Swipe right",
    swipeUp: "Swipe up",
    swipeDown: "Swipe down",
    openPalm: "Open palm ✋",
    closedFist: "Fist ✊",
    victory: "Victory ✌️",
    thumbUp: "Thumb up 👍",
    thumbDown: "Thumb down 👎",
    pointUp: "Pointing ☝️",
    pinch: "Pinch 👌",
}

/** MediaPipe category name → our gesture name. */
const POSE_FROM_CATEGORY: Record<string, GestureName> = {
    Open_Palm: "openPalm",
    Closed_Fist: "closedFist",
    Victory: "victory",
    Thumb_Up: "thumbUp",
    Thumb_Down: "thumbDown",
    Pointing_Up: "pointUp",
}

const HAND_CONNECTIONS: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17],
]

/* ------------------------------------------------------------------ *
 * Global gesture bus
 * Other components (including GestureSlider) can subscribe to this.
 * ------------------------------------------------------------------ */

export const GESTURE_EVENT = "zenboard:gesture"

type GestureDetail = { action: Action; gesture: GestureName; at: number }

function publish(detail: GestureDetail) {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent<GestureDetail>(GESTURE_EVENT, { detail }))

    const scope = window as any
    if (!scope.ZenGesture) {
        scope.ZenGesture = {
            last: null as GestureDetail | null,
            subscribe(callback: (d: GestureDetail) => void) {
                const handler = (event: Event) =>
                    callback((event as CustomEvent<GestureDetail>).detail)
                window.addEventListener(GESTURE_EVENT, handler)
                return () => window.removeEventListener(GESTURE_EVENT, handler)
            },
        }
    }
    scope.ZenGesture.last = detail
}

function dispatchKey(action: Action) {
    const spec = ACTION_KEY[action]
    if (!spec || typeof document === "undefined") return
    const target: EventTarget =
        (document.activeElement && document.activeElement !== document.body
            ? document.activeElement
            : document.body) ?? document
    const init: KeyboardEventInit & { keyCode: number; which: number } = {
        key: spec.key,
        code: spec.code,
        keyCode: spec.keyCode,
        which: spec.keyCode,
        bubbles: true,
        cancelable: true,
        composed: true,
    }
    target.dispatchEvent(new KeyboardEvent("keydown", init))
    target.dispatchEvent(new KeyboardEvent("keyup", init))
}

function clickSelector(selector: string) {
    if (!selector || typeof document === "undefined") return false
    let element: Element | null = null
    try {
        element = document.querySelector(selector)
    } catch {
        return false
    }
    if (!element) return false

    const base = { bubbles: true, cancelable: true, composed: true, view: window, button: 0 }
    const pointer = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true }
    try {
        element.dispatchEvent(new PointerEvent("pointerdown", pointer as PointerEventInit))
        element.dispatchEvent(new MouseEvent("mousedown", base))
        element.dispatchEvent(new PointerEvent("pointerup", pointer as PointerEventInit))
        element.dispatchEvent(new MouseEvent("mouseup", base))
        element.dispatchEvent(new MouseEvent("click", base))
    } catch {
        if (typeof (element as HTMLElement).click === "function") (element as HTMLElement).click()
    }
    return true
}

function scrollPage(direction: -1 | 1) {
    if (typeof window === "undefined") return
    window.scrollBy({ top: direction * window.innerHeight * 0.9, behavior: "smooth" })
}

/* ------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------ */

type Point = { x: number; y: number }
type Landmark = { x: number; y: number; z: number }

function palmCenter(landmarks: Landmark[]): Point {
    const ids = [0, 5, 9, 13, 17]
    let x = 0
    let y = 0
    for (const id of ids) {
        x += landmarks[id].x
        y += landmarks[id].y
    }
    return { x: x / ids.length, y: y / ids.length }
}

function distance(a: Landmark | Point, b: Landmark | Point) {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Wrist → middle-finger MCP: a rough, distance-invariant hand size. */
function handScale(landmarks: Landmark[]) {
    return Math.max(distance(landmarks[0], landmarks[9]), 0.02)
}

function isPinching(landmarks: Landmark[]) {
    return distance(landmarks[4], landmarks[8]) / handScale(landmarks) < 0.45
}

/* ------------------------------------------------------------------ *
 * Props
 * ------------------------------------------------------------------ */

interface Props {
    startMode: "button" | "auto"
    mirror: boolean
    showSkeleton: boolean
    showHints: boolean
    showStatus: boolean

    sensitivity: number
    cooldown: number
    holdTime: number
    inferenceFps: number

    mapSwipeLeft: Action
    mapSwipeRight: Action
    mapSwipeUp: Action
    mapSwipeDown: Action
    mapOpenPalm: Action
    mapClosedFist: Action
    mapVictory: Action
    mapThumbUp: Action
    mapPointUp: Action
    mapPinch: Action

    emitEvents: boolean
    emitKeyboard: boolean
    emitClicks: boolean
    nextSelector: string
    prevSelector: string

    accent: string
    surface: string
    textColor: string
    cornerRadius: number
    haptics: boolean
    debug: boolean
    modelUrl: string

    onNext?: () => void
    onPrev?: () => void
    onFirst?: () => void
    onLast?: () => void
    onPlayPause?: () => void
    onSelect?: () => void
    onGesture?: () => void

    style?: React.CSSProperties
}

type Status = "idle" | "starting" | "running" | "error"

export default function GestureCameraNav(props: Props) {
    const {
        startMode,
        mirror,
        showSkeleton,
        showHints,
        showStatus,
        sensitivity,
        cooldown,
        holdTime,
        inferenceFps,
        emitEvents,
        emitKeyboard,
        emitClicks,
        nextSelector,
        prevSelector,
        accent,
        surface,
        textColor,
        cornerRadius,
        haptics,
        debug,
        modelUrl,
        style,
    } = props

    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const isStatic =
        isCanvas ||
        RenderTarget.current() === RenderTarget.thumbnail ||
        RenderTarget.current() === RenderTarget.export

    const [status, setStatus] = React.useState<Status>("idle")
    const [statusText, setStatusText] = React.useState("")
    const [errorText, setErrorText] = React.useState("")
    const [handPresent, setHandPresent] = React.useState(false)
    const [toast, setToast] = React.useState<{ label: string; id: number } | null>(null)
    const [announcement, setAnnouncement] = React.useState("")
    const [compact, setCompact] = React.useState(false)
    const [fps, setFps] = React.useState(0)
    const [reducedMotion, setReducedMotion] = React.useState(false)

    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const videoRef = React.useRef<HTMLVideoElement | null>(null)
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
    const streamRef = React.useRef<MediaStream | null>(null)
    const recognizerRef = React.useRef<any>(null)
    const rafRef = React.useRef<number | null>(null)
    const runningRef = React.useRef(false)
    const generationRef = React.useRef(0)

    const trailRef = React.useRef<Array<{ x: number; y: number; t: number }>>([])
    const cooldownUntilRef = React.useRef(0)
    const poseRef = React.useRef<{ name: GestureName | null; since: number; fired: boolean }>({
        name: null,
        since: 0,
        fired: false,
    })
    const pinchRef = React.useRef(false)
    const lastVideoTimeRef = React.useRef(-1)
    const lastFrameAtRef = React.useRef(0)
    const fpsRef = React.useRef({ frames: 0, since: 0 })
    const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    /* --- keep the newest props available inside the animation loop --- */
    const propsRef = React.useRef(props)
    propsRef.current = props

    /* ---------------------------------------------------------------- *
     * Environment observers
     * ---------------------------------------------------------------- */

    React.useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const query = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setReducedMotion(query.matches)
        update()
        query.addEventListener?.("change", update)
        return () => query.removeEventListener?.("change", update)
    }, [])

    React.useEffect(() => {
        const element = rootRef.current
        if (!element || typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver((entries) => {
            const box = entries[0]?.contentRect
            if (!box) return
            setCompact(box.height < 190 || box.width < 260)
        })
        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    /* ---------------------------------------------------------------- *
     * Emitting actions
     * ---------------------------------------------------------------- */

    const fire = React.useCallback(
        (gesture: GestureName, action: Action) => {
            if (action === "none") return
            const current = propsRef.current

            if (current.emitEvents !== false) {
                publish({ action, gesture, at: Date.now() })
                switch (action) {
                    case "next":
                        current.onNext?.()
                        break
                    case "prev":
                        current.onPrev?.()
                        break
                    case "first":
                        current.onFirst?.()
                        break
                    case "last":
                        current.onLast?.()
                        break
                    case "playPause":
                        current.onPlayPause?.()
                        break
                    case "select":
                        current.onSelect?.()
                        break
                }
                current.onGesture?.()
            }

            if (current.emitClicks) {
                if (action === "next") clickSelector(current.nextSelector)
                if (action === "prev") clickSelector(current.prevSelector)
            }

            if (current.emitKeyboard) dispatchKey(action)

            if (action === "scrollUp") scrollPage(-1)
            if (action === "scrollDown") scrollPage(1)

            if (current.haptics && typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(12)
            }

            const label = ACTION_LABEL[action]
            setToast({ label, id: Date.now() })
            setAnnouncement(`${GESTURE_LABEL[gesture]}: ${label}`)
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            toastTimerRef.current = setTimeout(() => setToast(null), 1100)
        },
        []
    )

    const actionFor = React.useCallback((gesture: GestureName): Action => {
        const p = propsRef.current
        switch (gesture) {
            case "swipeLeft":
                return p.mapSwipeLeft
            case "swipeRight":
                return p.mapSwipeRight
            case "swipeUp":
                return p.mapSwipeUp
            case "swipeDown":
                return p.mapSwipeDown
            case "openPalm":
                return p.mapOpenPalm
            case "closedFist":
                return p.mapClosedFist
            case "victory":
                return p.mapVictory
            case "thumbUp":
                return p.mapThumbUp
            case "pointUp":
                return p.mapPointUp
            case "pinch":
                return p.mapPinch
            default:
                return "none"
        }
    }, [])

    /* ---------------------------------------------------------------- *
     * Recognition
     * ---------------------------------------------------------------- */

    const analyse = React.useCallback(
        (landmarks: Landmark[] | null, categoryName: string | null, score: number, now: number) => {
            const p = propsRef.current

            if (!landmarks) {
                trailRef.current.length = 0
                poseRef.current = { name: null, since: 0, fired: false }
                pinchRef.current = false
                return
            }

            const center = palmCenter(landmarks)
            const trail = trailRef.current
            trail.push({ x: center.x, y: center.y, t: now })
            while (trail.length > 2 && now - trail[0].t > 500) trail.shift()

            const inCooldown = now < cooldownUntilRef.current

            // --- swipes -------------------------------------------------
            // sensitivity 0 → needs a big movement, 1 → needs a small one.
            const threshold = 0.30 - 0.17 * clamp01(p.sensitivity)
            let swiped: GestureName | null = null
            let velocity = 0

            if (!inCooldown && trail.length >= 3) {
                const oldest = trail[0]
                const dt = now - oldest.t
                if (dt >= 70) {
                    const rawDx = center.x - oldest.x
                    const dy = center.y - oldest.y
                    // Convert to what the visitor sees in the (mirrored) preview.
                    const dx = p.mirror ? -rawDx : rawDx
                    const speed = Math.hypot(dx, dy) / (dt / 1000)
                    velocity = speed

                    if (speed > 0.5) {
                        if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
                            swiped = dx < 0 ? "swipeLeft" : "swipeRight"
                        } else if (Math.abs(dy) > threshold && Math.abs(dy) > Math.abs(dx) * 1.5) {
                            swiped = dy < 0 ? "swipeUp" : "swipeDown"
                        }
                    }
                }
            }

            if (swiped) {
                const action = actionFor(swiped)
                if (action !== "none") {
                    fire(swiped, action)
                    cooldownUntilRef.current = now + p.cooldown
                    trail.length = 0
                    poseRef.current = { name: null, since: 0, fired: false }
                    return
                }
            }

            // A moving hand is swiping, not posing — don't read poses mid-swipe.
            const settled = velocity < 0.35

            // --- pinch --------------------------------------------------
            const pinching = isPinching(landmarks)
            if (pinching && !pinchRef.current && settled && !inCooldown) {
                const action = actionFor("pinch")
                if (action !== "none") {
                    fire("pinch", action)
                    cooldownUntilRef.current = now + p.cooldown
                }
            }
            pinchRef.current = pinching

            // --- held poses ---------------------------------------------
            const pose =
                categoryName && score >= 0.6 ? POSE_FROM_CATEGORY[categoryName] ?? null : null

            if (!pose || !settled) {
                if (poseRef.current.name !== pose) {
                    poseRef.current = { name: pose, since: now, fired: false }
                }
                return
            }

            if (poseRef.current.name !== pose) {
                poseRef.current = { name: pose, since: now, fired: false }
                return
            }

            if (
                !poseRef.current.fired &&
                now - poseRef.current.since >= p.holdTime &&
                now >= cooldownUntilRef.current
            ) {
                const action = actionFor(pose)
                if (action !== "none") {
                    fire(pose, action)
                    cooldownUntilRef.current = now + p.cooldown
                }
                poseRef.current.fired = true
            }
        },
        [actionFor, fire]
    )

    /* ---------------------------------------------------------------- *
     * Drawing
     * ---------------------------------------------------------------- */

    const draw = React.useCallback(
        (hands: Landmark[][]) => {
            const canvas = canvasRef.current
            const video = videoRef.current
            if (!canvas || !video) return

            const width = canvas.clientWidth
            const height = canvas.clientHeight
            if (!width || !height) return

            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
                canvas.width = Math.round(width * dpr)
                canvas.height = Math.round(height * dpr)
            }

            const ctx = canvas.getContext("2d")
            if (!ctx) return
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, width, height)

            if (!propsRef.current.showSkeleton || hands.length === 0) return

            // The video uses object-fit: cover — reproduce that mapping so the
            // skeleton lands exactly on the visitor's hand.
            const vw = video.videoWidth || 640
            const vh = video.videoHeight || 480
            const scale = Math.max(width / vw, height / vh)
            const dw = vw * scale
            const dh = vh * scale
            const ox = (width - dw) / 2
            const oy = (height - dh) / 2
            const flip = propsRef.current.mirror

            const project = (lm: Landmark): Point => ({
                x: ox + (flip ? 1 - lm.x : lm.x) * dw,
                y: oy + lm.y * dh,
            })

            const color = propsRef.current.accent

            for (const landmarks of hands) {
                const points = landmarks.map(project)

                ctx.save()
                ctx.lineCap = "round"
                ctx.lineJoin = "round"

                ctx.strokeStyle = withAlpha(color, 0.22)
                ctx.lineWidth = 7
                strokeSkeleton(ctx, points)

                ctx.strokeStyle = withAlpha(color, 0.95)
                ctx.lineWidth = 2
                strokeSkeleton(ctx, points)

                for (let i = 0; i < points.length; i++) {
                    const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20
                    ctx.beginPath()
                    ctx.arc(points[i].x, points[i].y, isTip ? 3.6 : 2.2, 0, Math.PI * 2)
                    ctx.fillStyle = isTip ? "#FFFFFF" : withAlpha(color, 0.9)
                    ctx.fill()
                }
                ctx.restore()
            }
        },
        []
    )

    /* ---------------------------------------------------------------- *
     * Camera lifecycle
     * ---------------------------------------------------------------- */

    const stop = React.useCallback(() => {
        generationRef.current += 1
        runningRef.current = false
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        const stream = streamRef.current
        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        const video = videoRef.current
        if (video) {
            video.srcObject = null
        }
        const recognizer = recognizerRef.current
        recognizerRef.current = null
        if (recognizer && typeof recognizer.close === "function") {
            try {
                recognizer.close()
            } catch {
                /* already closed */
            }
        }
        trailRef.current.length = 0
        poseRef.current = { name: null, since: 0, fired: false }
        pinchRef.current = false
        lastVideoTimeRef.current = -1
        setHandPresent(false)
        setToast(null)
        setStatus("idle")
        setStatusText("")
    }, [])

    const start = React.useCallback(async () => {
        if (runningRef.current || isStatic) return
        const generation = ++generationRef.current
        runningRef.current = true
        setErrorText("")
        setStatus("starting")
        setStatusText("Asking for camera…")

        try {
            if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
                throw new Error(
                    "This browser can't open a camera here. Open the published site over HTTPS in Chrome, Edge or Safari."
                )
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 },
                },
                audio: false,
            })
            if (generation !== generationRef.current) {
                stream.getTracks().forEach((t) => t.stop())
                return
            }
            streamRef.current = stream

            const video = videoRef.current
            if (!video) throw new Error("Video surface is not ready.")
            video.srcObject = stream
            await video.play().catch(() => undefined)

            setStatusText("Loading hand model…")
            const vision = await loadVision()
            if (generation !== generationRef.current) return

            const recognizer = await createRecognizer(
                vision,
                propsRef.current.modelUrl || DEFAULT_MODEL_URL,
                1
            )
            if (generation !== generationRef.current) {
                recognizer?.close?.()
                return
            }
            recognizerRef.current = recognizer

            setStatus("running")
            setStatusText("")
            fpsRef.current = { frames: 0, since: performance.now() }

            const loop = () => {
                if (generation !== generationRef.current) return
                rafRef.current = requestAnimationFrame(loop)

                const currentVideo = videoRef.current
                const currentRecognizer = recognizerRef.current
                if (!currentVideo || !currentRecognizer) return
                if (typeof document !== "undefined" && document.hidden) return
                if (currentVideo.readyState < 2) return

                const now = performance.now()
                const minInterval = 1000 / Math.max(8, propsRef.current.inferenceFps)
                if (now - lastFrameAtRef.current < minInterval) return
                lastFrameAtRef.current = now

                if (currentVideo.currentTime === lastVideoTimeRef.current) return
                lastVideoTimeRef.current = currentVideo.currentTime

                let result: any
                try {
                    result = currentRecognizer.recognizeForVideo(currentVideo, now)
                } catch {
                    return
                }

                const hands: Landmark[][] = result?.landmarks ?? []
                const landmarks = hands[0] ?? null
                const category = result?.gestures?.[0]?.[0]
                analyse(landmarks, category?.categoryName ?? null, category?.score ?? 0, now)
                draw(hands)

                setHandPresent((was) => (was === !!landmarks ? was : !!landmarks))

                if (propsRef.current.debug) {
                    const meter = fpsRef.current
                    meter.frames += 1
                    if (now - meter.since >= 500) {
                        setFps(Math.round((meter.frames * 1000) / (now - meter.since)))
                        meter.frames = 0
                        meter.since = now
                    }
                }
            }

            rafRef.current = requestAnimationFrame(loop)
        } catch (err) {
            runningRef.current = false
            const name = (err as { name?: string })?.name
            let message: string
            if (name === "NotAllowedError" || name === "SecurityError") {
                message =
                    "Camera access was blocked. Allow the camera in your browser's address bar, then try again."
            } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
                message = "No camera was found on this device."
            } else if (name === "NotReadableError") {
                message = "The camera is already in use by another app. Close it and try again."
            } else {
                message = err instanceof Error ? err.message : "Something went wrong starting the camera."
            }
            setErrorText(message)
            setStatus("error")
            setStatusText("")
            const stream = streamRef.current
            if (stream) {
                stream.getTracks().forEach((t) => t.stop())
                streamRef.current = null
            }
        }
    }, [analyse, draw, isStatic])

    React.useEffect(() => {
        if (isStatic) return
        if (startMode === "auto") void start()
        return () => stop()
        // Restarting on a mapping change would be disruptive; the loop reads
        // the live props through propsRef instead.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStatic, startMode])

    React.useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        }
    }, [])

    /* ---------------------------------------------------------------- *
     * Render
     * ---------------------------------------------------------------- */

    const motionMs = reducedMotion ? 0 : T.duration.base
    const radius = cornerRadius

    const shell: React.CSSProperties = {
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        borderRadius: radius,
        background: surface,
        color: textColor,
        fontFamily: T.font,
        boxShadow: T.shadow.floating,
        border: `1px solid ${withAlpha(textColor, 0.1)}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        WebkitTapHighlightColor: "transparent",
        ...style,
    }

    const hints = React.useMemo(() => buildHints(props), [props])

    return (
        <div ref={rootRef} style={shell}>
            <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: mirror ? "scaleX(-1)" : "none",
                    opacity: status === "running" ? 1 : 0,
                    transition: `opacity ${motionMs}ms ${T.ease.standard}`,
                    background: "#000",
                }}
            />
            <canvas
                ref={canvasRef}
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    opacity: status === "running" ? 1 : 0,
                    transition: `opacity ${motionMs}ms ${T.ease.standard}`,
                }}
            />

            {/* Screen-reader feedback for every recognised action */}
            <div
                aria-live="polite"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0 0 0 0)",
                    clipPath: "inset(50%)",
                    whiteSpace: "nowrap",
                }}
            >
                {announcement}
            </div>

            {isStatic && <CanvasPlaceholder accent={accent} textColor={textColor} compact={compact} />}

            {!isStatic && (status === "idle" || status === "error") && (
                <StartPanel
                    compact={compact}
                    accent={accent}
                    textColor={textColor}
                    error={status === "error" ? errorText : ""}
                    onStart={() => void start()}
                />
            )}

            {!isStatic && status === "starting" && (
                <LoadingPanel accent={accent} textColor={textColor} label={statusText} />
            )}

            {!isStatic && status === "running" && (
                <>
                    {showStatus && (
                        <StatusPill
                            accent={accent}
                            active={handPresent}
                            label={handPresent ? "Hand detected" : "Show your hand"}
                        />
                    )}

                    <button
                        type="button"
                        onClick={stop}
                        aria-label="Turn camera off"
                        title="Turn camera off"
                        style={{
                            position: "absolute",
                            top: T.space[2],
                            right: T.space[2],
                            width: 28,
                            height: 28,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: T.radius.full,
                            border: "none",
                            cursor: "pointer",
                            color: "#fff",
                            background: "rgba(0,0,0,0.45)",
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                            transition: `background ${T.duration.fast}ms ${T.ease.standard}`,
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <path
                                d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>

                    {toast && (
                        <div
                            key={toast.id}
                            style={{
                                position: "absolute",
                                left: "50%",
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                                padding: `${T.space[2]}px ${T.space[4]}px`,
                                borderRadius: T.radius.full,
                                background: withAlpha(accent, 0.92),
                                color: readableOn(accent),
                                boxShadow: T.shadow.medium,
                                pointerEvents: "none",
                                ...T.type.h4,
                                animation: reducedMotion
                                    ? undefined
                                    : `zenPop ${T.duration.slow}ms ${T.ease.standard}`,
                            }}
                        >
                            {toast.label}
                        </div>
                    )}

                    {showHints && !compact && hints.length > 0 && (
                        <div
                            style={{
                                position: "absolute",
                                left: T.space[2],
                                right: T.space[2],
                                bottom: T.space[2],
                                display: "flex",
                                flexWrap: "wrap",
                                gap: T.space[1],
                                padding: `${T.space[2]}px ${T.space[3]}px`,
                                borderRadius: T.radius.md,
                                background: "rgba(0,0,0,0.42)",
                                backdropFilter: "blur(10px)",
                                WebkitBackdropFilter: "blur(10px)",
                                color: "rgba(255,255,255,0.92)",
                                ...T.type.caption,
                            }}
                        >
                            {hints.map((hint, index) => (
                                <span key={hint} style={{ whiteSpace: "nowrap" }}>
                                    {hint}
                                    {index < hints.length - 1 && (
                                        <span style={{ opacity: 0.45, padding: `0 ${T.space[1]}px` }}>·</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}

                    {debug && (
                        <div
                            style={{
                                position: "absolute",
                                left: T.space[2],
                                bottom: showHints && !compact ? 56 : T.space[2],
                                padding: `2px ${T.space[2]}px`,
                                borderRadius: T.radius.sm,
                                background: "rgba(0,0,0,0.55)",
                                color: "#fff",
                                fontVariantNumeric: "tabular-nums",
                                ...T.type.caption,
                            }}
                        >
                            {fps} fps
                        </div>
                    )}
                </>
            )}

            <style>{`
                @keyframes zenPop {
                    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.94); }
                    18%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    75%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
                }
                @keyframes zenSpin { to { transform: rotate(360deg); } }
                @keyframes zenPulse {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.35; }
                }
            `}</style>
        </div>
    )
}

/* ------------------------------------------------------------------ *
 * Sub-views
 * ------------------------------------------------------------------ */

function StartPanel({
    compact,
    accent,
    textColor,
    error,
    onStart,
}: {
    compact: boolean
    accent: string
    textColor: string
    error: string
    onStart: () => void
}) {
    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: compact ? T.space[2] : T.space[3],
                padding: compact ? T.space[3] : T.space[5],
                textAlign: "center",
                maxWidth: 320,
            }}
        >
            <div
                style={{
                    width: compact ? 32 : 40,
                    height: compact ? 32 : 40,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: T.radius.lg,
                    background: withAlpha(accent, 0.14),
                    color: accent,
                }}
            >
                <HandIcon size={compact ? 18 : 22} />
            </div>

            {!compact && (
                <div style={{ ...T.type.h4, color: textColor }}>
                    {error ? "Camera unavailable" : "Control with gestures"}
                </div>
            )}

            <div
                style={{
                    ...T.type.body,
                    color: withAlpha(textColor, error ? 0.85 : 0.62),
                    maxWidth: 260,
                }}
            >
                {error || "Runs entirely on your device. Nothing is recorded or uploaded."}
            </div>

            <button
                type="button"
                onClick={onStart}
                style={{
                    marginTop: T.space[1],
                    padding: `${T.space[2]}px ${T.space[4]}px`,
                    borderRadius: T.radius.full,
                    border: "none",
                    cursor: "pointer",
                    background: accent,
                    color: readableOn(accent),
                    ...T.type.label,
                    boxShadow: T.shadow.medium,
                    transition: `transform ${T.duration.fast}ms ${T.ease.standard}, opacity ${T.duration.fast}ms ${T.ease.standard}`,
                }}
                onMouseDown={(event) => {
                    event.currentTarget.style.transform = "scale(0.97)"
                }}
                onMouseUp={(event) => {
                    event.currentTarget.style.transform = "scale(1)"
                }}
                onMouseLeave={(event) => {
                    event.currentTarget.style.transform = "scale(1)"
                }}
            >
                {error ? "Try again" : "Turn on camera"}
            </button>
        </div>
    )
}

function LoadingPanel({
    accent,
    textColor,
    label,
}: {
    accent: string
    textColor: string
    label: string
}) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: T.space[3],
                padding: T.space[4],
            }}
        >
            <div
                style={{
                    width: 22,
                    height: 22,
                    borderRadius: T.radius.full,
                    border: `2px solid ${withAlpha(textColor, 0.16)}`,
                    borderTopColor: accent,
                    animation: `zenSpin 720ms linear infinite`,
                }}
            />
            <div style={{ ...T.type.body, color: withAlpha(textColor, 0.66) }}>
                {label || "Starting…"}
            </div>
        </div>
    )
}

function StatusPill({
    accent,
    active,
    label,
}: {
    accent: string
    active: boolean
    label: string
}) {
    return (
        <div
            style={{
                position: "absolute",
                top: T.space[2],
                left: T.space[2],
                display: "inline-flex",
                alignItems: "center",
                gap: T.space[2],
                padding: `${T.space[1]}px ${T.space[3]}px ${T.space[1]}px ${T.space[2]}px`,
                borderRadius: T.radius.full,
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                color: "rgba(255,255,255,0.94)",
                ...T.type.caption,
            }}
        >
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: T.radius.full,
                    background: active ? accent : "rgba(255,255,255,0.5)",
                    animation: active ? undefined : "zenPulse 1.6s ease-in-out infinite",
                }}
            />
            {label}
        </div>
    )
}

function CanvasPlaceholder({
    accent,
    textColor,
    compact,
}: {
    accent: string
    textColor: string
    compact: boolean
}) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: T.space[2],
                padding: T.space[4],
                textAlign: "center",
            }}
        >
            <div style={{ color: accent }}>
                <HandIcon size={compact ? 20 : 26} />
            </div>
            {!compact && (
                <div style={{ ...T.type.label, color: textColor }}>Gesture Camera Nav</div>
            )}
            <div style={{ ...T.type.caption, color: withAlpha(textColor, 0.55), maxWidth: 220 }}>
                Camera starts in Preview and on the published site.
            </div>
        </div>
    )
}

function HandIcon({ size = 22 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0 0V4.5a1.5 1.5 0 0 1 3 0V11m0 0V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3l-2-3.4a1.5 1.5 0 0 1 2.4-1.8L9 14V11Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

function strokeSkeleton(ctx: CanvasRenderingContext2D, points: Point[]) {
    ctx.beginPath()
    for (const [a, b] of HAND_CONNECTIONS) {
        if (!points[a] || !points[b]) continue
        ctx.moveTo(points[a].x, points[a].y)
        ctx.lineTo(points[b].x, points[b].y)
    }
    ctx.stroke()
}

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value))
}

function parseColor(input: string): [number, number, number] | null {
    if (!input) return null
    const value = input.trim()
    const hex = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
    if (hex) {
        let body = hex[1]
        if (body.length === 3) body = body.split("").map((c) => c + c).join("")
        return [
            parseInt(body.slice(0, 2), 16),
            parseInt(body.slice(2, 4), 16),
            parseInt(body.slice(4, 6), 16),
        ]
    }
    const rgb = value.match(/rgba?\(([^)]+)\)/i)
    if (rgb) {
        const parts = rgb[1].split(",").map((p) => parseFloat(p))
        if (parts.length >= 3) return [parts[0], parts[1], parts[2]]
    }
    return null
}

function withAlpha(color: string, alpha: number) {
    const rgb = parseColor(color)
    if (!rgb) return color
    return `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha})`
}

/** Pick black or white text so labels stay readable on any accent colour. */
function readableOn(background: string) {
    const rgb = parseColor(background)
    if (!rgb) return "#FFFFFF"
    const [r, g, b] = rgb.map((channel) => {
        const c = channel / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return luminance > 0.45 ? "#0B0B0C" : "#FFFFFF"
}

function buildHints(props: Props): string[] {
    const hints: string[] = []
    const add = (gesture: GestureName, action: Action) => {
        if (action === "none") return
        hints.push(`${GESTURE_LABEL[gesture]} → ${ACTION_LABEL[action].replace(/[←→⇤⇥]\s?/g, "").trim()}`)
    }
    add("swipeLeft", props.mapSwipeLeft)
    add("swipeRight", props.mapSwipeRight)
    add("openPalm", props.mapOpenPalm)
    add("pinch", props.mapPinch)
    return hints.slice(0, 4)
}

/* ------------------------------------------------------------------ *
 * Framer property controls
 * ------------------------------------------------------------------ */

const actionControl = (title: string, defaultValue: Action) => ({
    type: ControlType.Enum as const,
    title,
    options: ACTION_OPTIONS,
    optionTitles: ACTION_TITLES,
    defaultValue,
})

addPropertyControls(GestureCameraNav, {
    startMode: {
        type: ControlType.Enum,
        title: "Start",
        options: ["button", "auto"],
        optionTitles: ["Ask first", "Automatic"],
        displaySegmentedControl: true,
        defaultValue: "button",
        description: "“Ask first” is friendlier — visitors tap a button before the camera opens.",
    },

    mapSwipeLeft: actionControl("Swipe ←", "next"),
    mapSwipeRight: actionControl("Swipe →", "prev"),
    mapSwipeUp: actionControl("Swipe ↑", "none"),
    mapSwipeDown: actionControl("Swipe ↓", "none"),
    mapOpenPalm: actionControl("Open palm ✋", "playPause"),
    mapClosedFist: actionControl("Fist ✊", "prev"),
    mapVictory: actionControl("Victory ✌️", "next"),
    mapThumbUp: actionControl("Thumb up 👍", "none"),
    mapPointUp: actionControl("Point ☝️", "none"),
    mapPinch: actionControl("Pinch 👌", "select"),

    emitEvents: {
        type: ControlType.Boolean,
        title: "Framer events",
        defaultValue: true,
        description: "Wire onNext / onPrev in the Interactions panel to your slider.",
    },
    emitClicks: {
        type: ControlType.Boolean,
        title: "Click target",
        defaultValue: false,
    },
    nextSelector: {
        type: ControlType.String,
        title: "Next CSS",
        defaultValue: "[data-framer-name='Next']",
        placeholder: "[data-framer-name='Next']",
        hidden: (props: Props) => !props.emitClicks,
    },
    prevSelector: {
        type: ControlType.String,
        title: "Prev CSS",
        defaultValue: "[data-framer-name='Previous']",
        placeholder: "[data-framer-name='Previous']",
        hidden: (props: Props) => !props.emitClicks,
    },
    emitKeyboard: {
        type: ControlType.Boolean,
        title: "Keyboard",
        defaultValue: false,
        description: "Also sends ArrowRight / ArrowLeft to the page.",
    },

    sensitivity: {
        type: ControlType.Number,
        title: "Sensitivity",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.5,
        displayStepper: false,
    },
    cooldown: {
        type: ControlType.Number,
        title: "Cooldown",
        min: 200,
        max: 3000,
        step: 50,
        defaultValue: 900,
        unit: "ms",
    },
    holdTime: {
        type: ControlType.Number,
        title: "Hold time",
        min: 200,
        max: 2500,
        step: 50,
        defaultValue: 650,
        unit: "ms",
        description: "How long a pose must be held before it fires.",
    },
    inferenceFps: {
        type: ControlType.Number,
        title: "Tracking FPS",
        min: 10,
        max: 60,
        step: 1,
        defaultValue: 24,
    },

    mirror: { type: ControlType.Boolean, title: "Mirror", defaultValue: true },
    showSkeleton: { type: ControlType.Boolean, title: "Hand overlay", defaultValue: true },
    showStatus: { type: ControlType.Boolean, title: "Status pill", defaultValue: true },
    showHints: { type: ControlType.Boolean, title: "Hints", defaultValue: true },
    haptics: { type: ControlType.Boolean, title: "Vibrate", defaultValue: true },
    debug: { type: ControlType.Boolean, title: "Show FPS", defaultValue: false },

    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#6E56CF" },
    surface: { type: ControlType.Color, title: "Surface", defaultValue: "#0B0B0C" },
    textColor: { type: ControlType.Color, title: "Text", defaultValue: "#FFFFFF" },
    cornerRadius: {
        type: ControlType.Number,
        title: "Radius",
        min: 0,
        max: 48,
        step: 1,
        defaultValue: 16,
        unit: "px",
    },

    modelUrl: {
        type: ControlType.String,
        title: "Model URL",
        defaultValue: DEFAULT_MODEL_URL,
        description: "Advanced — host the .task file yourself if you prefer.",
    },

    onNext: { type: ControlType.EventHandler },
    onPrev: { type: ControlType.EventHandler },
    onFirst: { type: ControlType.EventHandler },
    onLast: { type: ControlType.EventHandler },
    onPlayPause: { type: ControlType.EventHandler },
    onSelect: { type: ControlType.EventHandler },
    onGesture: { type: ControlType.EventHandler },
})

GestureCameraNav.displayName = "Gesture Camera Nav"
