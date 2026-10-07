import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AboutText } from "@/components/AboutText";
import { Avatar } from "@/components/Avatar";
import { IconArrowRight } from "@/components/Icons";
import { getAbout } from "@/lib/about";
import { getAlbums, getMembers } from "@/lib/data";
import { yearOf } from "@/lib/format";
import groupPhoto from "../../../public/about/ninh-binh.jpg";

export const metadata: Metadata = { title: "About" };

// Đổi ảnh nhóm: thay file public/about/ninh-binh.jpg (giữ tên) hoặc đổi import ở trên.
const PHOTO = { alt: "The crew in front of the “Ninh Bình xin chào!” wall", caption: "Ninh Bình" };

/**
 * Trang giới thiệu: dải phim tối có tiêu đề, ảnh nhóm in đè lên mép dải, bên dưới là cả nhóm,
 * vài con số của archive và các đoạn chữ do thành viên tự viết (sửa ngay trên trang).
 */
export default async function AboutPage() {
  const [about, crew, albums] = await Promise.all([getAbout(), getMembers(), getAlbums()]);

  const photos = albums.reduce((s, a) => s + a.photoCount, 0);
  const places = new Set(albums.map((a) => a.location)).size;
  const since = albums.length ? yearOf(albums[albums.length - 1].tripDate) : null;
  const facts = [
    { value: crew.length, label: crew.length === 1 ? "person" : "people" },
    { value: albums.length, label: albums.length === 1 ? "trip" : "trips" },
    { value: photos, label: photos === 1 ? "photo" : "photos" },
    { value: places, label: places === 1 ? "place" : "places" },
  ];

  return (
    <main className="pb-24">
      <div className="bg-film text-white">
        <div className="sprockets h-3" aria-hidden="true" />
        {/* Đệm dưới = phần ảnh nằm đè lên dải */}
        <div className="px-4 pt-14 pb-[clamp(7rem,22vw,15rem)] text-center sm:px-6 sm:pt-20">
          <p className="frame-no text-sm">&#9656; thesix{since ? `, since ${since}` : ""}</p>
          <h1
            className="mt-3 font-display text-[clamp(2.6rem,7.5vw,5rem)] leading-none font-extrabold tracking-[-0.04em] text-balance"
            style={{ fontStretch: "125%" }}
          >
            About the crew
          </h1>
        </div>
      </div>

      <figure className="mx-auto -mt-[clamp(6rem,20vw,13.5rem)] max-w-[820px] px-4 sm:px-6">
        <div className="print rotate-[-0.5deg] shadow-[var(--shadow-hard-lg)]">
          <Image
            src={groupPhoto}
            alt={PHOTO.alt}
            placeholder="blur"
            preload
            sizes="(max-width: 860px) 100vw, 820px"
            className="block h-auto w-full rounded-[1px]"
          />
        </div>
        <figcaption className="mt-3 flex items-baseline gap-2 px-0.5 text-sm text-ink-soft">
          <span className="frame-no text-[0.7rem]">&#9656; 1</span>
          {PHOTO.caption}
        </figcaption>
      </figure>

      <div className="mx-auto mt-12 flex max-w-[680px] flex-col gap-12 px-4 sm:mt-16 sm:px-6">
        {/* Cả nhóm + vài con số */}
        <section aria-label="The crew in numbers" className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-3" aria-label="Members">
            {crew.map((m) => (
              <li key={m.id} className="group relative -mr-3 last:mr-0" title={m.name}>
                <span className="block rounded-full ring-[3px] ring-bg transition-transform duration-200 group-hover:-translate-y-1">
                  <Avatar name={m.name} url={m.avatarUrl} size={48} />
                </span>
                <span className="sr-only">{m.name}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-1.5">
                <dd className="font-display text-2xl font-extrabold tabular-nums">{f.value}</dd>
                <dt className="text-sm text-ink-soft">{f.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <AboutText paragraphs={about.paragraphs} updatedAt={about.updatedAt} updatedBy={about.updatedBy} />

        <Link href="/albums" className="btn btn-primary h-11 self-start px-5">
          Browse the trips
          <IconArrowRight size={16} />
        </Link>
      </div>
    </main>
  );
}
