import type { SVGProps } from "react";
import type { IconType } from "react-icons";
import {
  MdAdd,
  MdChatBubbleOutline,
  MdArrowBack,
  MdArrowForward,
  MdCheck,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdExpandMore,
  MdFavorite,
  MdFavoriteBorder,
  MdInfoOutline,
  MdLink,
  MdOpenInNew,
  MdOutlineCalendarToday,
  MdOutlineDarkMode,
  MdOutlineDashboard,
  MdOutlineDelete,
  MdOutlineEdit,
  MdOutlineFileDownload,
  MdOutlineFileUpload,
  MdOutlineFolder,
  MdOutlineInsights,
  MdOutlineLightMode,
  MdOutlineLock,
  MdOutlinePerson,
  MdOutlinePhoto,
  MdOutlinePlace,
  MdOutlineTheaters,
  MdOutlineViewDay,
  MdPause,
  MdPlayArrow,
  MdRestartAlt,
  MdSearch,
  MdStar,
  MdStarBorder,
  MdZoomIn,
  MdZoomOut,
} from "react-icons/md";

// Bộ icon Material Design của Google (qua react-icons, SVG thuần, chạy được trong Server Component).
// Giữ nguyên tên Icon* cũ để chỗ gọi không phải đổi.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function material(Icon: IconType) {
  function MaterialIcon({ size = 18, ...props }: IconProps) {
    return <Icon size={size} aria-hidden="true" {...(props as object)} />;
  }
  return MaterialIcon;
}

/** Icon có hai trạng thái rỗng / đặc (yêu thích, ảnh bìa). */
function toggleable(Outline: IconType, Filled: IconType) {
  function MaterialToggleIcon({ filled = false, size = 18, ...props }: IconProps & { filled?: boolean }) {
    const Icon = filled ? Filled : Outline;
    return <Icon size={size} aria-hidden="true" {...(props as object)} />;
  }
  return MaterialToggleIcon;
}

export const IconArrowLeft = material(MdArrowBack);
export const IconArrowRight = material(MdArrowForward);
export const IconChevronLeft = material(MdChevronLeft);
export const IconChevronRight = material(MdChevronRight);
export const IconChevronDown = material(MdExpandMore);
export const IconClose = material(MdClose);
export const IconSearch = material(MdSearch);
export const IconUpload = material(MdOutlineFileUpload);
export const IconDownload = material(MdOutlineFileDownload);
export const IconImage = material(MdOutlinePhoto);
export const IconFolder = material(MdOutlineFolder);
export const IconPin = material(MdOutlinePlace);
export const IconCalendar = material(MdOutlineCalendarToday);
export const IconInfo = material(MdInfoOutline);
export const IconExternal = material(MdOpenInNew);
export const IconLink = material(MdLink);
export const IconTrash = material(MdOutlineDelete);
export const IconReset = material(MdRestartAlt);
export const IconLock = material(MdOutlineLock);
export const IconUser = material(MdOutlinePerson);
export const IconSun = material(MdOutlineLightMode);
export const IconMoon = material(MdOutlineDarkMode);
export const IconHeart = toggleable(MdFavoriteBorder, MdFavorite);
export const IconStar = toggleable(MdStarBorder, MdStar);
export const IconEdit = material(MdOutlineEdit);
export const IconPlay = material(MdPlayArrow);
export const IconPause = material(MdPause);
export const IconZoomIn = material(MdZoomIn);
export const IconZoomOut = material(MdZoomOut);
export const IconGrid = material(MdOutlineDashboard);
export const IconTimeline = material(MdOutlineViewDay);
export const IconFilm = material(MdOutlineTheaters);
export const IconStats = material(MdOutlineInsights);
export const IconPlus = material(MdAdd);
export const IconCheck = material(MdCheck);
export const IconComment = material(MdChatBubbleOutline);

export const IconGoogle = ({ size = 20, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...props}>
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
    />
  </svg>
);
