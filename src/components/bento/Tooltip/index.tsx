import React, { useState, useRef } from "react";

type Props = {
  children: React.ReactNode;
};

const Tooltip: React.FC<Props> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  const messages = [
    "",
    "Hi there!",
    "Clicked again?",
    "Still here?",
    "Persistent, aren't you?",
    "What's up?",
    "Again? Really?",
    "You're curious!",
    "Not cool!",
    "Give it a break!",
    "That's annoying!",
    "Hands off!",
    "No more clicks!",
    "Seriously?!",
    "Ouch! That hurts!",
    "You're persistent!",
    "Why the curiosity?",
    "I'm getting tired!",
    "I'm bored!",
    "Enough's enough!",
    "Find another hobby!",
    "Stop, please!",
    "Okay, last one!",
    "That's it, I'm done!",
  ];

  const currentMessage = messages[Math.min(clickCount, messages.length - 1)];

  const handlePressStart = () => {
    setIsVisible(true);
    setClickCount((prev) => prev + 1);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, 3000);
  };

  const handlePressEnd = () => {
    setIsVisible(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        {children}
      </div>

      {isVisible && (
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-28 w-64 p-3 bg-black text-white text-center rounded-lg z-20
  shadow-[2px_2px_0_#0ea5e9] border border-[#0ea5e9] whitespace-normal overflow-visible">
  <p className="text-sm">{currentMessage}</p>

  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-3 h-3
    bg-black rotate-45 border border-[#0ea5e9]" />
</div>


      )}
    </div>
  );
};

export default Tooltip;
