export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`${className} relative`}>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer Circle */}
        <circle 
          cx="50" 
          cy="50" 
          r="48" 
          stroke="currentColor" 
          strokeWidth="4" 
          fill="none"
        />
        
        {/* Top Arrow (Right) */}
        <g className="arrow-top">
          {/* Arrow line */}
          <path 
            d="M 25 35 L 55 35" 
            stroke="currentColor" 
            strokeWidth="6" 
            strokeLinecap="round"
          />
          {/* Arrow head */}
          <path 
            d="M 48 28 L 62 35 L 48 42" 
            stroke="currentColor" 
            strokeWidth="6" 
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
        
        {/* Bottom Arrow (Left) */}
        <g className="arrow-bottom">
          {/* Arrow line */}
          <path 
            d="M 75 65 L 45 65" 
            stroke="currentColor" 
            strokeWidth="6" 
            strokeLinecap="round"
          />
          {/* Arrow head */}
          <path 
            d="M 52 58 L 38 65 L 52 72" 
            stroke="currentColor" 
            strokeWidth="6" 
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
}
