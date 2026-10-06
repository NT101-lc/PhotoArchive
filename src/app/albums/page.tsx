import type { Metadata } from "next";
import { AlbumBrowser, SORTS, type SortKey } from "@/components/AlbumBrowser";
import { PageHero } from "@/components/PageHero";
import { UploadButton } from "@/components/UploadModal";
import { getAlbums } from "@/lib/data";

export const metadata: Metadata = { title: "All albums" };

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AlbumsPage({ searchParams }: PageProps<"/albums">) {
  const [albums, sp] = await Promise.all([getAlbums(), searchParams]);
  const totalPhotos = albums.reduce((sum, a) => sum + a.photoCount, 0);
  const places = new Set(albums.map((a) => a.location)).size;

  const sort = first(sp.sort);
  const initial = {
    q: first(sp.q) ?? "",
    year: first(sp.year) ?? "all",
    place: first(sp.place) ?? "all",
    sort: (sort && sort in SORTS ? sort : "newest") as SortKey,
  };

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6">
      <PageHero
        eyebrow="Trip archive"
        title="Every trip we took"
        description="All of the crew's travel photos, grouped by trip — come back to them any time."
        stats={[
          { value: albums.length, label: "Albums" },
          { value: totalPhotos, label: "Photos", color: "accent" },
          { value: places, label: "Places", color: "teal" },
        ]}
        actions={<UploadButton albums={albums.map(({ id, title }) => ({ id, title }))} />}
      />
      <AlbumBrowser albums={albums} initial={initial} />
    </main>
  );
}
