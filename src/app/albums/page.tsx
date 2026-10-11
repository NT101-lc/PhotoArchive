import type { Metadata } from "next";
import { AlbumBrowser, SORTS, type SortKey } from "@/components/AlbumBrowser";
import { PageHero } from "@/components/PageHero";
import { IconPlus } from "@/components/Icons";
import { UploadButton } from "@/components/UploadModal";
import { getAlbums } from "@/lib/data";
import { distinctPlaceNames } from "@/lib/places-format";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.albums.metaTitle };
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** `?year=2025&year=2024` → ["2025", "2024"] */
function list(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
}

export default async function AlbumsPage({ searchParams }: PageProps<"/albums">) {
  const [albums, sp, { t }] = await Promise.all([getAlbums(), searchParams, getT()]);
  const totalPhotos = albums.reduce((sum, a) => sum + a.photoCount, 0);
  const albumOptions = albums.map(({ id, title, createdById }) => ({ id, title, createdById }));
  const places = distinctPlaceNames(albums).length;

  const sort = first(sp.sort);
  const initial = {
    q: first(sp.q) ?? "",
    year: list(sp.year),
    place: list(sp.place),
    sort: (sort && sort in SORTS ? sort : "newest") as SortKey,
  };

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6">
      <PageHero
        eyebrow={t.albums.eyebrow}
        title={t.albums.title}
        description={t.albums.description}
        stats={[
          { value: albums.length, label: t.albums.statAlbums },
          { value: totalPhotos, label: t.albums.statPhotos },
          { value: places, label: t.albums.statPlaces },
        ]}
        actions={
          <>
            <UploadButton albums={albumOptions} startNew className="btn">
              <IconPlus size={16} />
              {t.albums.newAlbum}
            </UploadButton>
            <UploadButton albums={albumOptions} />
          </>
        }
      />
      <AlbumBrowser albums={albums} initial={initial} />
    </main>
  );
}
