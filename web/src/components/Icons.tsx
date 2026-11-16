import * as H from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown as PArrowDown, ArrowElbowDownRight, ArrowLeft as PArrowLeft, ArrowUp as PArrowUp,
  ArrowUpRight as PArrowUpRight, Brain as PBrain, ChatCircleText, Check as PCheck, Copy as PCopy,
  DownloadSimple, GearSix, Moon as PMoon, PaintBrush, PawPrint, Plus as PPlus, SidebarSimple,
  SlidersHorizontal, SquaresFour, Sun as PSun, X, Eye as PEye, type Icon as PhIcon,
} from "@phosphor-icons/react";

type P = { size?: number };
const lib = H as unknown as Record<string, unknown>;

/** Hugeicons first (first name that exists wins), Phosphor if none of the names exist. */
function make(names: string[], Fallback: PhIcon) {
  const icon = names.map((n) => lib[n]).find(Boolean);
  return ({ size = 16 }: P) =>
    icon ? <HugeiconsIcon icon={icon as never} size={size} strokeWidth={1.5} /> : <Fallback size={size} weight="regular" />;
}

export const Plus = make(["PlusSignIcon", "Add01Icon"], PPlus);
export const Close = make(["Cancel01Icon"], X);
export const Check = make(["Tick02Icon"], PCheck);
export const ArrowUp = make(["ArrowUp02Icon", "ArrowUp01Icon"], PArrowUp);
export const ArrowDown = make(["ArrowDown01Icon"], PArrowDown);
export const ArrowLeft = make(["ArrowLeft01Icon"], PArrowLeft);
export const ArrowUpRight = make(["ArrowUpRight01Icon"], PArrowUpRight);
export const CopyIcon = make(["Copy01Icon"], PCopy);
export const PanelLeft = make(["SidebarLeftIcon"], SidebarSimple);
export const Elbow = make(["CornerDownRightIcon", "ArrowTurnDownIcon"], ArrowElbowDownRight);
export const Download = make(["Download01Icon"], DownloadSimple);
export const Settings = make(["Settings01Icon"], GearSix);
export const Sun = make(["Sun03Icon", "Sun01Icon"], PSun);
export const Moon = make(["Moon02Icon", "Moon01Icon"], PMoon);
export const Brain = make(["Brain02Icon", "BrainIcon"], PBrain);
export const Paw = make(["PawPrint01Icon", "PawPrintIcon"], PawPrint);
export const Sliders = make(["SlidersHorizontalIcon"], SlidersHorizontal);
export const Brush = make(["PaintBrush02Icon", "PaintBoardIcon"], PaintBrush);
export const Chat = make(["BubbleChatIcon", "Message01Icon"], ChatCircleText);
export const Eye = make(["ViewIcon", "EyeIcon"], PEye);
export const Grid = make(["DashboardSquare01Icon", "GridViewIcon"], SquaresFour);
export const FileIcon = make(["File01Icon"], X);
export const FileCode = make(["FileCodeIcon", "SourceCodeIcon"], X);
export const Download02 = make(["Download02Icon", "Download01Icon"], DownloadSimple);
export const Copy01 = make(["Copy01Icon"], PCopy);