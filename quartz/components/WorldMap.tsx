import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/worldmap.inline"
import style from "./styles/worldmap.scss"

const WorldMap: QuartzComponent = () => null

WorldMap.css = style
WorldMap.afterDOMLoaded = script

export default (() => WorldMap) satisfies QuartzComponentConstructor
