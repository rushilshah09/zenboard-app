/**
 * Zenboard — Gesture Slider
 * =========================
 * A slider / carousel that listens to the Gesture Camera Nav component.
 *
 * Use this when you don't already have a slider on the page. Drop both
 * components on the canvas and they connect automatically — no wiring needed.
 * It also works on its own with arrow keys, dots, arrows and touch swipes.
 *
 * HOW TO USE IN FRAMER
 * --------------------
 *  1. Framer → Assets → Code → New Code File → paste this whole file.
 *  2. Drag it onto the page and stretch it to the size you want.
 *  3. In the properties panel, add your slides (any Framer layer or component).
 *  4. Add "Gesture Camera Nav" anywhere on the same page — done.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 480
 */

import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

/* ------------------------------------------------------------------ *
 * Design tokens (mirrors GestureCameraNav so both feel like one system)
 * ------------------------------------------------------------------ */

const T = {
    space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 },
    radius: { sm: 8, md: 12, lg: 16, full: 999 },
    shadow: { medium: "0 4px 16px rgba(0,0,0,0.18)" },
    duration: { fast: 0.12, base: 0.2, slow: 0.42 },
    ease: [0.2, 0, 0, 1] as [number, number, number, number],
    type: {
        body: { fontSize: 13, lineHeight: "18px", fontWeight: 500 },
        caption: { fontSize: 11, lineHeight: "15px", fontWeight: 500 },
    },
    font: `Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
}

/** Must match the event name published by GestureCameraNav. */
const GESTURE_EVENT = "zenboard:gesture"

type Action = "next" | "prev" | "first" | "last" | "playPause" | "select" | string

interface Props {
    slides: React.ReactNode[]
    transition: "slide" | "fade" | "scale"
    loop: boolean
    autoplay: boolean
    autoplayInterval: number
    showArrows: boolean
    showDots: boolean
    showCounter: boolean
    dragToSwipe: boolean
    listenToGestures: boolean
    listenToKeyboard: boolean
    background: string
    accent: string
    cornerRadius: number
    onChange?: () => void
    style?: React.CSSProperties
}

export default function GestureSlider(props: Props) {
    const {
        slides,
        transition,
        loop,
        autoplay,
        autoplayInterval,
        showArrows,
        showDots,
        showCounter,
        dragToSwipe,
        listenToGestures,
        listenToKeyboard,
        background,
        accent,
        cornerRadius,
        onChange,
        style,
    } = props

    const count = slides?.length ?? 0
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const prefersReducedMotion = useReducedMotion()

    const [index, setIndex] = React.useState(0)
    const [direction, setDirection] = React.useState<1 | -1>(1)
    const [playing, setPlaying] = React.useState(autoplay)

    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const indexRef = React.useRef(0)
    indexRef.current = index

    React.useEffect(() => setPlaying(autoplay), [autoplay])

    /* ---------------------------------------------------------------- *
     * Navigation
     * ---------------------------------------------------------------- */

    const goTo = React.useCallback(
        (target: number, dir: 1 | -1) => {
            if (count === 0) return
            let next = target
            if (loop) {
                next = ((target % count) + count) % count
            } else {
                next = Math.min(count - 1, Math.max(0, target))
            }
            if (next === indexRef.current) return
            setDirection(dir)
            setIndex(next)
            onChange?.()
        },
        [count, loop, onChange]
    )

    const next = React.useCallback(() => goTo(indexRef.current + 1, 1), [goTo])
    const prev = React.useCallback(() => goTo(indexRef.current - 1, -1), [goTo])

    const runAction = React.useCallback(
        (action: Action) => {
            switch (action) {
                case "next":
                    next()
                    break
                case "prev":
                    prev()
                    break
                case "first":
                    goTo(0, -1)
                    break
                case "last":
                    goTo(count - 1, 1)
                    break
                case "playPause":
                    setPlaying((was) => !was)
                    break
            }
        },
        [count, goTo, next, prev]
    )

    /* ---------------------------------------------------------------- *
     * Inputs: gesture bus, keyboard, autoplay
     * ---------------------------------------------------------------- */

    React.useEffect(() => {
        if (isCanvas || !listenToGestures || typeof window === "undefined") return
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ action: Action }>).detail
            if (detail?.action) runAction(detail.action)
        }
        window.addEventListener(GESTURE_EVENT, handler)
        return () => window.removeEventListener(GESTURE_EVENT, handler)
    }, [isCanvas, listenToGestures, runAction])

    React.useEffect(() => {
        if (isCanvas || !listenToKeyboard || typeof window === "undefined") return
        const handler = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            const tag = target?.tagName
            if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return
            if (event.key === "ArrowRight") {
                next()
            } else if (event.key === "ArrowLeft") {
                prev()
            } else if (event.key === "Home") {
                goTo(0, -1)
            } else if (event.key === "End") {
                goTo(count - 1, 1)
            } else {
                return
            }
            event.preventDefault()
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [count, goTo, isCanvas, listenToKeyboard, next, prev])

    React.useEffect(() => {
        if (isCanvas || !playing || count < 2) return
        const timer = setInterval(next, Math.max(1200, autoplayInterval))
        return () => clearInterval(timer)
    }, [autoplayInterval, count, isCanvas, next, playing])

    /* ---------------------------------------------------------------- *
     * Motion
     * ---------------------------------------------------------------- */

    const useFade = prefersReducedMotion || transition === "fade"
    const duration = prefersReducedMotion ? T.duration.fast : T.duration.slow

    const variants = React.useMemo(
        () => ({
            enter: (dir: 1 | -1) =>
                useFade
                    ? { opacity: 0, x: 0, scale: 1 }
                    : transition === "scale"
                      ? { opacity: 0, scale: 1.04, x: 0 }
                      : { opacity: 0, x: dir * 48, scale: 1 },
            center: { opacity: 1, x: 0, scale: 1 },
            exit: (dir: 1 | -1) =>
                useFade
                    ? { opacity: 0, x: 0, scale: 1 }
                    : transition === "scale"
                      ? { opacity: 0, scale: 0.97, x: 0 }
                      : { opacity: 0, x: dir * -48, scale: 1 },
        }),
        [transition, useFade]
    )

    /* ---------------------------------------------------------------- *
     * Render
     * ---------------------------------------------------------------- */

    const shell: React.CSSProperties = {
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: cornerRadius,
        background,
        fontFamily: T.font,
        ...style,
    }

    if (count === 0) {
        return (
            <div style={{ ...shell, display: "grid", placeItems: "center" }}>
                <div
                    style={{
                        ...T.type.body,
                        color: "rgba(255,255,255,0.6)",
                        textAlign: "center",
                        padding: T.space[4],
                    }}
                >
                    Add slides in the properties panel →
                </div>
            </div>
        )
    }

    const atStart = !loop && index === 0
    const atEnd = !loop && index === count - 1

    return (
        <div
            ref={rootRef}
            style={shell}
            role="region"
            aria-roledescription="carousel"
            aria-label="Gesture controlled slides"
        >
            <AnimatePresence initial={false} custom={direction}>
                <motion.div
                    key={index}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration, ease: T.ease }}
                    drag={dragToSwipe && !isCanvas ? "x" : false}
                    dragElastic={0.14}
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={(
                        _event: unknown,
                        info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
                    ) => {
                        const power = info.offset.x + info.velocity.x * 0.12
                        if (power < -80) next()
                        else if (power > 80) prev()
                    }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: dragToSwipe ? "grab" : "default",
                    }}
                    aria-roledescription="slide"
                    aria-label={`Slide ${index + 1} of ${count}`}
                >
                    {slides[index]}
                </motion.div>
            </AnimatePresence>

            {showArrows && count > 1 && (
                <>
                    <ArrowButton
                        side="left"
                        accent={accent}
                        disabled={atStart}
                        onClick={prev}
                        label="Previous slide"
                    />
                    <ArrowButton
                        side="right"
                        accent={accent}
                        disabled={atEnd}
                        onClick={next}
                        label="Next slide"
                    />
                </>
            )}

            {showDots && count > 1 && (
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: T.space[4],
                        display: "flex",
                        justifyContent: "center",
                        gap: T.space[2],
                    }}
                >
                    {slides.map((_slide, dotIndex) => {
                        const active = dotIndex === index
                        return (
                            <button
                                key={dotIndex}
                                type="button"
                                aria-label={`Go to slide ${dotIndex + 1}`}
                                aria-current={active ? "true" : undefined}
                                onClick={() => goTo(dotIndex, dotIndex > index ? 1 : -1)}
                                style={{
                                    width: active ? 22 : 8,
                                    height: 8,
                                    padding: 0,
                                    border: "none",
                                    borderRadius: T.radius.full,
                                    cursor: "pointer",
                                    background: active ? accent : "rgba(255,255,255,0.38)",
                                    transition: `width ${T.duration.base}s, background ${T.duration.base}s`,
                                }}
                            />
                        )
                    })}
                </div>
            )}

            {showCounter && count > 1 && (
                <div
                    style={{
                        position: "absolute",
                        top: T.space[3],
                        right: T.space[3],
                        padding: `${T.space[1]}px ${T.space[2]}px`,
                        borderRadius: T.radius.full,
                        background: "rgba(0,0,0,0.42)",
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        color: "rgba(255,255,255,0.92)",
                        fontVariantNumeric: "tabular-nums",
                        ...T.type.caption,
                    }}
                >
                    {index + 1} / {count}
                </div>
            )}

            <div
                aria-live="polite"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clipPath: "inset(50%)",
                    whiteSpace: "nowrap",
                }}
            >
                {`Slide ${index + 1} of ${count}`}
            </div>
        </div>
    )
}

function ArrowButton({
    side,
    accent,
    disabled,
    onClick,
    label,
}: {
    side: "left" | "right"
    accent: string
    disabled: boolean
    onClick: () => void
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            style={{
                position: "absolute",
                top: "50%",
                left: side === "left" ? T.space[3] : undefined,
                right: side === "right" ? T.space[3] : undefined,
                transform: "translateY(-50%)",
                width: 36,
                height: 36,
                display: "grid",
                placeItems: "center",
                borderRadius: T.radius.full,
                border: "none",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.3 : 1,
                color: "#fff",
                background: "rgba(0,0,0,0.42)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                boxShadow: T.shadow.medium,
                transition: `opacity ${T.duration.base}s, background ${T.duration.base}s`,
            }}
            onFocus={(event) => {
                event.currentTarget.style.outline = `2px solid ${accent}`
                event.currentTarget.style.outlineOffset = "2px"
            }}
            onBlur={(event) => {
                event.currentTarget.style.outline = "none"
            }}
        >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                    d={side === "left" ? "M9 2 L4 7 L9 12" : "M5 2 L10 7 L5 12"}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
    )
}

addPropertyControls(GestureSlider, {
    slides: {
        type: ControlType.Array,
        title: "Slides",
        control: { type: ControlType.ComponentInstance },
        maxCount: 40,
    },
    transition: {
        type: ControlType.Enum,
        title: "Transition",
        options: ["slide", "fade", "scale"],
        optionTitles: ["Slide", "Fade", "Scale"],
        displaySegmentedControl: true,
        defaultValue: "slide",
    },
    loop: { type: ControlType.Boolean, title: "Loop", defaultValue: true },
    autoplay: { type: ControlType.Boolean, title: "Autoplay", defaultValue: false },
    autoplayInterval: {
        type: ControlType.Number,
        title: "Interval",
        min: 1200,
        max: 20000,
        step: 100,
        defaultValue: 5000,
        unit: "ms",
        hidden: (props: Props) => !props.autoplay,
    },
    showArrows: { type: ControlType.Boolean, title: "Arrows", defaultValue: true },
    showDots: { type: ControlType.Boolean, title: "Dots", defaultValue: true },
    showCounter: { type: ControlType.Boolean, title: "Counter", defaultValue: false },
    dragToSwipe: { type: ControlType.Boolean, title: "Drag", defaultValue: true },
    listenToGestures: {
        type: ControlType.Boolean,
        title: "Gestures",
        defaultValue: true,
        description: "Follows the Gesture Camera Nav component on the same page.",
    },
    listenToKeyboard: { type: ControlType.Boolean, title: "Arrow keys", defaultValue: true },
    background: { type: ControlType.Color, title: "Background", defaultValue: "#0B0B0C" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#6E56CF" },
    cornerRadius: {
        type: ControlType.Number,
        title: "Radius",
        min: 0,
        max: 64,
        step: 1,
        defaultValue: 16,
        unit: "px",
    },
    onChange: { type: ControlType.EventHandler },
})

GestureSlider.displayName = "Gesture Slider"
