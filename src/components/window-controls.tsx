"use client";

import { useEffect, useState } from "react";
import { CopyIcon, MinusIcon, SquareIcon, XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    void window.formiaDesktop?.isWindowMaximized().then(setIsMaximized);
  }, []);

  return (
    <div className="formia-no-drag ml-auto flex h-full items-stretch">
      <Button type="button" variant="ghost" size="icon-sm" className="h-full w-11 rounded-none text-[#5d5d5d] hover:bg-black/5 hover:text-foreground" onClick={() => void window.formiaDesktop?.minimizeWindow()} aria-label="Minimize window">
        <MinusIcon className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="h-full w-11 rounded-none text-[#5d5d5d] hover:bg-black/5 hover:text-foreground"
        onClick={() => void window.formiaDesktop?.toggleMaximizeWindow().then(setIsMaximized)}
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
      >
        {isMaximized ? <CopyIcon className="size-3.5" /> : <SquareIcon className="size-3.5" />}
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" className="h-full w-11 rounded-none text-[#5d5d5d] hover:bg-[#c42b1c] hover:text-white" onClick={() => void window.formiaDesktop?.closeWindow()} aria-label="Close window">
        <XIcon className="size-3.5" />
      </Button>
    </div>
  );
}
