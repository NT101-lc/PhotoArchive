import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { IconArrowLeft, IconImage } from "@/components/Icons";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <EmptyState
        icon={<IconImage size={26} />}
        title="Album not found"
        action={
          <Link href="/" className="btn btn-primary">
            <IconArrowLeft size={16} /> Back home
          </Link>
        }
      >
        This album doesn’t exist or has been deleted. Head back to the archive and pick another trip.
      </EmptyState>
    </main>
  );
}
