export function GitHubMark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.04c-3.34.73-4.04-1.42-4.04-1.42-.55-1.4-1.34-1.77-1.34-1.77-1.1-.75.08-.74.08-.74 1.2.09 1.84 1.25 1.84 1.25 1.08 1.85 2.84 1.32 3.54 1.01.1-.79.42-1.32.76-1.62-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.37 1.24-3.2-.13-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.22a11.4 11.4 0 0 1 6 0c2.28-1.54 3.29-1.22 3.29-1.22.66 1.64.25 2.86.12 3.16.77.83 1.24 1.89 1.24 3.2 0 4.62-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.57A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

export function GoogleMark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.4l2.6-2.5C17 3.4 14.8 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.1-1.5z"
      />
    </svg>
  );
}
