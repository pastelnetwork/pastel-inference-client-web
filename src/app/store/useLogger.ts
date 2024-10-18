// src/app/store/useStore.ts

import { create } from "zustand";

interface LoggerState {
  logMsg: string;
}

interface LoggerActions {
  setLogMessage: (msg: string) => void;
}

const useStore = create<LoggerState & LoggerActions>()(
  (set, get) => ({
    logMsg: '',

    setLogMessage: (logMsg) => set({ logMsg }),
  })
);

export default useStore;
