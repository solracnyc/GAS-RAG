# Framer Motion v12.23.22 Technical Reference

## LAZY_MOTION_SETUP

### FEATURE_BUNDLE_IMPORT
```javascript
// Synchronous import
import { LazyMotion, domAnimation, domMax } from "motion/react"
import * as m from "motion/react-m"

// Basic setup
function App() {
  return (
    <LazyMotion features={domAnimation}>
      <m.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} />
    </LazyMotion>
  )
}

// Async code-splitting
const loadFeatures = () =>
  import("./features.js").then(res => res.default)

function AppAsync() {
  return (
    <LazyMotion features={loadFeatures}>
      <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} />
    </LazyMotion>
  )
}
```

### DOMANIMATION_VS_DOMMAX
```javascript
[
  {
    use_when: "Basic animations, variants, exit animations, tap/hover/focus gestures",
    size_kb: 15
  },
  {
    use_when: "All domAnimation features + pan/drag gestures + layout animations",
    size_kb: 25
  }
]
```

### SSR_SAFE_CONFIG
```javascript
'use client'
import { LazyMotion, domAnimation } from "motion/react"
import * as m from "motion/react-m"

export function MotionWrapper({ children }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}

// Server component usage
import { MotionWrapper, m } from "@/components/MotionWrapper"

export default function ServerPage() {
  return (
    <MotionWrapper>
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
    </MotionWrapper>
  )
}
```

## ANIMATION_PATTERNS

### LAYOUT_ANIMATION_REACT19
```javascript
import { motion, LayoutGroup } from "motion/react"
import { useState } from "react"

function LayoutAnimationReact19() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <LayoutGroup>
      <motion.div
        layout
        style={{
          width: isOpen ? "400px" : "200px",
          height: isOpen ? "300px" : "150px",
          willChange: "transform"
        }}
        transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
        onClick={() => setIsOpen(!isOpen)}
      />

      <motion.div
        layoutId="shared-element"
        style={{ backgroundColor: "#3b82f6" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </LayoutGroup>
  )
}
```

### PRESENCE_ANIMATION
```javascript
import { motion, AnimatePresence } from "motion/react"

function PresenceAnimation({ items }) {
  return (
    <AnimatePresence mode="popLayout">
      {items.map(item => (
        <motion.div
          key={item.id}
          layout
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.2 }}
        >
          {item.content}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

// Slideshow pattern
function Slideshow({ currentIndex, direction }) {
  const variants = {
    hidden: (direction) => ({ opacity: 0, x: direction > 0 ? 300 : -300 }),
    visible: { opacity: 1, x: 0 }
  }

  return (
    <AnimatePresence custom={direction} mode="wait">
      <motion.div
        key={currentIndex}
        custom={direction}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </AnimatePresence>
  )
}
```

### SCROLL_TRIGGERED
```javascript
import { motion, useScroll, useTransform, useSpring, useInView } from "motion/react"
import { useRef } from "react"

// whileInView pattern
function ScrollTriggered() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6 }}
    />
  )
}

// useInView hook pattern
function UseInViewPattern() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })

  return (
    <motion.div
      ref={ref}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -100 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    />
  )
}

// Scroll progress pattern
function ScrollProgress() {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  })

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 1.2])
  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    ["#3b82f6", "#10b981", "#f59e0b"]
  )

  return (
    <motion.div
      ref={containerRef}
      style={{ scale, backgroundColor }}
    />
  )
}
```

### GESTURE_ANIMATIONS
```javascript
import { motion, useMotionValue, useTransform } from "motion/react"

// Basic gestures
function GestureBasic() {
  return (
    <motion.button
      whileHover={{ scale: 1.05, backgroundColor: "#3b82f6" }}
      whileTap={{ scale: 0.95 }}
      whileFocus={{ borderColor: "#10b981" }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    />
  )
}

// Drag pattern
function DragGesture() {
  return (
    <motion.div
      drag
      dragConstraints={{ top: 0, left: 0, right: 300, bottom: 300 }}
      dragElastic={0.2}
      whileDrag={{ scale: 1.1, rotate: 5 }}
      onDragStart={() => console.log("Drag started")}
      onDrag={(event, info) => console.log(info.point.x, info.point.y)}
      onDragEnd={() => console.log("Drag ended")}
      style={{ cursor: "grab" }}
    />
  )
}

// 3D tilt with drag
function TiltCard() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useTransform(y, [-100, 100], [30, -30])
  const rotateY = useTransform(x, [-100, 100], [-30, 30])

  return (
    <motion.div
      style={{ x, y, rotateX, rotateY, z: 100 }}
      drag
      dragElastic={0.18}
      dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
      whileTap={{ cursor: "grabbing" }}
    />
  )
}

// Pan gesture
function PanGesture() {
  return (
    <motion.div
      onPan={(event, info) => console.log(info.delta.x, info.delta.y)}
      onPanStart={() => console.log("Pan started")}
      onPanEnd={() => console.log("Pan ended")}
      style={{ touchAction: "none" }}
    />
  )
}
```

## PERFORMANCE_OPTIMIZATIONS

### WILL_CHANGE_AUTO
```javascript
false // Not confirmed as default in v12.23.22
```

### GPU_ACCELERATION_PROPS
```javascript
[
  "x",
  "y",
  "z",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY",
  "transformPerspective",
  "opacity"
]
```

### REDUCE_MOTION_PATTERN
```javascript
import { MotionConfig, useReducedMotion, motion } from "motion/react"

// Site-wide configuration
export function App({ children }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  )
}

// Hook pattern for custom behavior
function Component({ isOpen }) {
  const shouldReduceMotion = useReducedMotion()

  const animate = isOpen
    ? shouldReduceMotion
      ? { opacity: 1 }
      : { x: 0, opacity: 1 }
    : shouldReduceMotion
      ? { opacity: 0 }
      : { x: "-100%", opacity: 0 }

  return <motion.div animate={animate} />
}

// Conditional animations
function AdaptiveAnimation() {
  const shouldReduceMotion = useReducedMotion()
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 1], [0, -0.2])

  return (
    <motion.div
      style={{ y: shouldReduceMotion ? 0 : y }}
      animate={{ opacity: 1 }}
    />
  )
}
```

## SSR_HYDRATION

### HYDRATION_SAFE
```javascript
true
```

### INITIAL_FALSE_PATTERN
```javascript
// Basic SSR-safe pattern
<motion.div
  initial={false}
  animate={{ opacity: 1, y: 0 }}
/>

// With AnimatePresence for page transitions
<AnimatePresence initial={false}>
  <motion.div key={router.asPath}>
    <Component {...pageProps} />
  </motion.div>
</AnimatePresence>

// Conditional first render
const firstRender = useRef(true)

useEffect(() => {
  if (firstRender.current) {
    firstRender.current = false
    return
  }
})

const variants = {
  initial: { opacity: 0, height: 0 },
  enter: { opacity: 1, height: "auto" }
}

return (
  <motion.div
    variants={firstRender.current ? {} : variants}
    initial="initial"
    animate="enter"
  />
)

// Client-only wrapper for SSR
const ClientOnly = ({ children }) => {
  const [clientReady, setClientReady] = useState(false)

  useEffect(() => {
    setClientReady(true)
  }, [])

  return clientReady ? <>{children}</> : null
}
```

### STYLE_INJECTION_FIX
```javascript
null // No specific fixes required for Next.js 15.5

// CSP support if needed
<MotionConfig nonce={nonce}>
  <motion.div animate={{ x: 100 }} />
</MotionConfig>
```