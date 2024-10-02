import { create } from 'zustand'

interface PastelState {
  pastelId: string
  setPastelId: (id: string) => void
  creditPacks: any[]
  setCreditPacks: (packs: any[]) => void
  // Add more state and actions as needed
}

const useStore = create<PastelState>((set) => ({
  pastelId: '',
  setPastelId: (id) => set({ pastelId: id }),
  creditPacks: [],
  setCreditPacks: (packs) => set({ creditPacks: packs }),
  // Implement more actions
}))

export default useStore