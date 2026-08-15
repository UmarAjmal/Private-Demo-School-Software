export default function Loading() {
  return (
    <>
      <style>{`
        /* ─── Outer wrapper ─── */
        .ld-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 78vh;
          width: 100%;
          background: #F5FBE6;
          gap: 32px;
        }

        /* ─── 3-ring orbital ─── */
        .ld-orbital {
          position: relative;
          width: 120px;
          height: 120px;
        }

        /* Centre glowing circle */
        .ld-core {
          position: absolute;
          inset: 50%;
          transform: translate(-50%, -50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FE7F2D, #ff9a4f);
          box-shadow: 0 0 0 6px rgba(254,127,45,0.18),
                      0 0 24px rgba(254,127,45,0.45);
          animation: ld-corePulse 2s ease-in-out infinite;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        @keyframes ld-corePulse {
          0%,100% { box-shadow: 0 0 0 6px rgba(254,127,45,0.18), 0 0 24px rgba(254,127,45,0.45); transform: translate(-50%,-50%) scale(1); }
          50%     { box-shadow: 0 0 0 10px rgba(254,127,45,0.1), 0 0 36px rgba(254,127,45,0.65); transform: translate(-50%,-50%) scale(1.08); }
        }

        /* Shared ring style */
        .ld-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 3px solid transparent;
        }

        /* Ring 1 orange, tilted on X */
        .ld-ring1 {
          border-top-color: #FE7F2D;
          border-bottom-color: rgba(254,127,45,0.2);
          transform: rotateX(60deg) rotateZ(0deg);
          animation: ld-spin1 1.3s linear infinite;
          box-shadow: 0 0 8px rgba(254,127,45,0.3);
        }
        @keyframes ld-spin1 { to { transform: rotateX(60deg) rotateZ(360deg); } }

        /* Ring 2 teal, tilted on Y */
        .ld-ring2 {
          border-right-color: #215E61;
          border-left-color: rgba(33,94,97,0.2);
          transform: rotateY(60deg) rotateZ(0deg);
          animation: ld-spin2 1.8s linear infinite reverse;
          box-shadow: 0 0 8px rgba(33,94,97,0.3);
        }
        @keyframes ld-spin2 { to { transform: rotateY(60deg) rotateZ(360deg); } }

        /* Ring 3 dark, flat equatorial */
        .ld-ring3 {
          border-top-color: #233D4D;
          border-bottom-color: rgba(35,61,77,0.2);
          transform: rotateX(0deg) rotateZ(0deg);
          animation: ld-spin3 2.2s linear infinite;
          box-shadow: 0 0 8px rgba(35,61,77,0.25);
        }
        @keyframes ld-spin3 { to { transform: rotateX(0deg) rotateZ(360deg); } }

        /* ─── Loading text ─── */
        .ld-label {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: #233D4D;
          animation: ld-labelFade 2s ease-in-out infinite;
        }
        @keyframes ld-labelFade {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.35; }
        }

        /* ─── Three bouncing dots ─── */
        .ld-dots {
          display: flex;
          gap: 10px;
        }
        .ld-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          animation: ld-bounce 1.1s ease-in-out infinite;
        }
        .ld-dot:nth-child(1){ background:#FE7F2D; animation-delay:0ms;   }
        .ld-dot:nth-child(2){ background:#215E61; animation-delay:160ms; }
        .ld-dot:nth-child(3){ background:#233D4D; animation-delay:320ms; }
        @keyframes ld-bounce {
          0%,80%,100% { transform: translateY(0)   scale(0.75); opacity:0.5; }
          40%         { transform: translateY(-10px) scale(1.15); opacity:1;   }
        }
      `}</style>

      <div className="ld-center">
        {/* 3D orbital rings */}
        <div className="ld-orbital">
          <div className="ld-ring ld-ring1" />
          <div className="ld-ring ld-ring2" />
          <div className="ld-ring ld-ring3" />
          <div className="ld-core">SMS</div>
        </div>

        {/* Text */}
        <div className="ld-label">Loading</div>

        {/* Dots */}
        <div className="ld-dots">
          <div className="ld-dot" />
          <div className="ld-dot" />
          <div className="ld-dot" />
        </div>
      </div>
    </>
  );
}
