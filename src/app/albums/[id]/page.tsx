import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlbumAdminActions } from "@/components/AlbumAdminActions";
import { AlbumDetailButton } from "@/components/AlbumDetailButton";
import { AlbumView } from "@/components/AlbumView";
import { IconCalendar, IconPin } from "@/components/Icons";
import { PageHero } from "@/components/PageHero";
import { UploadButton } from "@/components/UploadModal";
import { getAlbum, getAlbums, getPhotos } from "@/lib/data";
import { formatDateRange, plural, tripDays } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/albums/[id]">): Promise<Metadata> {
  const { id } = await params;
  const album = await getAlbum(id);
  return { title: album?.title ?? "Album not found" };
}

export default async function AlbumPage({ params, searchParams }: PageProps<"/albums/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [album, photos, albums] = await Promise.all([getAlbum(id), getPhotos(id), getAlbums()]);
  if (!album) notFound();

  const contributors = new Set(photos.map((p) => p.uploadedBy)).size;
  const photoParam = Array.isArray(sp.photo) ? sp.photo[0] : sp.photo;

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6">
      <PageHero
        backHref="/albums"
        eyebrow="All albums"
        title={album.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <IconPin size={15} />
              <b className="font-semibold text-ink">{album.location}</b>
            </span>
            <span className="flex items-center gap-1.5">
              <IconCalendar size={15} />
              {formatDateRange(album.tripDate, album.endDate)}
              {album.endDate && <span>({plural(tripDays(album.tripDate, album.endDate), "day")})</span>}
            </span>
          </span>
        }
        stats={[
          { value: photos.length, label: "photos" },
          { value: contributors, label: "people" },
        ]}
        actions={
          <>
            <UploadButton albums={albums.map(({ id, title, createdById }) => ({ id, title, createdById }))} defaultAlbumId={album.id} />
            <AlbumDetailButton album={album} photos={photos} />
            <AlbumAdminActions album={album} />
          </>
        }
      />

      <AlbumView album={album} photos={photos} initialPhotoId={photoParam} />
    </main>
  );
}
