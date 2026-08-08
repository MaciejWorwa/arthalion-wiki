type MapState = {
  scale: number
  fitScale: number
  x: number
  y: number
}

document.addEventListener("nav", () => {
  const map = document.querySelector<HTMLElement>(".world-map")
  if (!map) return

  const viewport = map.querySelector<HTMLElement>(".world-map__viewport")!
  const image = map.querySelector<HTMLImageElement>("img")!
  const zoomOutput = map.querySelector<HTMLOutputElement>(".world-map__zoom")!
  const loader = map.querySelector<HTMLElement>(".world-map__loader")!
  const state: MapState = { scale: 1, fitScale: 1, x: 0, y: 0 }
  const pointers = new Map<number, PointerEvent>()
  let previousPinchDistance = 0
  let resizeFrame = 0

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

  const bounds = () => {
    const width = image.naturalWidth * state.scale
    const height = image.naturalHeight * state.scale
    return {
      x: Math.max(0, (width - viewport.clientWidth) / 2),
      y: Math.max(0, (height - viewport.clientHeight) / 2),
    }
  }

  const render = () => {
    const limit = bounds()
    state.x = clamp(state.x, -limit.x, limit.x)
    state.y = clamp(state.y, -limit.y, limit.y)
    image.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`
    zoomOutput.value = `${Math.round((state.scale / state.fitScale) * 100)}%`
  }

  const fit = () => {
    if (!image.naturalWidth || !image.naturalHeight) return
    state.fitScale = Math.min(
      viewport.clientWidth / image.naturalWidth,
      viewport.clientHeight / image.naturalHeight,
    )
    state.scale = state.fitScale
    state.x = 0
    state.y = 0
    render()
  }

  const zoomAt = (factor: number, clientX: number, clientY: number) => {
    const previousScale = state.scale
    const nextScale = clamp(previousScale * factor, state.fitScale, state.fitScale * 8)
    if (nextScale === previousScale) return

    const rect = viewport.getBoundingClientRect()
    const pointerX = clientX - rect.left - rect.width / 2
    const pointerY = clientY - rect.top - rect.height / 2
    const ratio = nextScale / previousScale
    state.x = pointerX - (pointerX - state.x) * ratio
    state.y = pointerY - (pointerY - state.y) * ratio
    state.scale = nextScale
    render()
  }

  const centerZoom = (factor: number) => {
    const rect = viewport.getBoundingClientRect()
    zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY)
  }

  const onPointerDown = (event: PointerEvent) => {
    pointers.set(event.pointerId, event)
    viewport.setPointerCapture(event.pointerId)
    viewport.classList.add("is-dragging")
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      previousPinchDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId)
    if (!previous) return
    pointers.set(event.pointerId, event)

    if (pointers.size === 1) {
      state.x += event.clientX - previous.clientX
      state.y += event.clientY - previous.clientY
      render()
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const centerX = (a.clientX + b.clientX) / 2
      const centerY = (a.clientY + b.clientY) / 2
      if (previousPinchDistance > 0) zoomAt(distance / previousPinchDistance, centerX, centerY)
      previousPinchDistance = distance
    }
  }

  const releasePointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
    if (pointers.size < 2) previousPinchDistance = 0
    if (pointers.size === 0) viewport.classList.remove("is-dragging")
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const step = 48
    if (event.key === "+" || event.key === "=") centerZoom(1.25)
    else if (event.key === "-") centerZoom(0.8)
    else if (event.key === "0") fit()
    else if (event.key === "ArrowLeft") state.x += step
    else if (event.key === "ArrowRight") state.x -= step
    else if (event.key === "ArrowUp") state.y += step
    else if (event.key === "ArrowDown") state.y -= step
    else return
    event.preventDefault()
    render()
  }

  const onToolbarClick = async (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-map-action]")
    if (!button) return
    const action = button.dataset.mapAction
    if (action === "zoom-in") centerZoom(1.25)
    else if (action === "zoom-out") centerZoom(0.8)
    else if (action === "reset") fit()
    else if (action === "fullscreen") {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await map.requestFullscreen()
    }
  }

  const onResize = () => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(fit)
  }

  const onImageReady = () => {
    loader.hidden = true
    image.classList.add("is-loaded")
    fit()
  }

  viewport.addEventListener("wheel", onWheel, { passive: false })
  viewport.addEventListener("pointerdown", onPointerDown)
  viewport.addEventListener("pointermove", onPointerMove)
  viewport.addEventListener("pointerup", releasePointer)
  viewport.addEventListener("pointercancel", releasePointer)
  viewport.addEventListener("dblclick", (event) => zoomAt(1.5, event.clientX, event.clientY))
  viewport.addEventListener("keydown", onKeyDown)
  map.addEventListener("click", onToolbarClick)
  window.addEventListener("resize", onResize)
  document.addEventListener("fullscreenchange", onResize)
  image.addEventListener("load", onImageReady)

  if (image.complete && image.naturalWidth) onImageReady()

  window.addCleanup(() => {
    cancelAnimationFrame(resizeFrame)
    viewport.removeEventListener("wheel", onWheel)
    viewport.removeEventListener("pointerdown", onPointerDown)
    viewport.removeEventListener("pointermove", onPointerMove)
    viewport.removeEventListener("pointerup", releasePointer)
    viewport.removeEventListener("pointercancel", releasePointer)
    viewport.removeEventListener("keydown", onKeyDown)
    map.removeEventListener("click", onToolbarClick)
    window.removeEventListener("resize", onResize)
    document.removeEventListener("fullscreenchange", onResize)
    image.removeEventListener("load", onImageReady)
  })
})
