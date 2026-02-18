import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fw-card-strong p-7">
      <div className="text-lg font-semibold text-gray-900">Person not found</div>
      <div className="mt-2 text-sm text-gray-600">
        This person doesn’t exist, or you don’t have access to view them.
      </div>
      <div className="mt-5 flex gap-2">
        <Link href="/dashboard/people" className="fw-btn text-sm">
          Back to People
        </Link>
        <Link href="/dashboard" className="fw-btn text-sm">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
