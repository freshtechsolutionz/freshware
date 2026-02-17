type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, right }: Props) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      {right && <div>{right}</div>}
    </div>
  );
}
