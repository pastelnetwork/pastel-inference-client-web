import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import BrowserRPCReplacement from '../lib/BrowserRPCReplacement'
import * as api from '../lib/api'

interface WalletState {
  isLocked: boolean
  networkMode: 'Mainnet' | 'Testnet' | 'Devnet'
  pastelId: string
  balance: number
  addresses: string[]
  creditPacks: any[]
}

interface WalletActions {
  setLocked: (isLocked: boolean) => void
  setNetworkMode: (mode: 'Mainnet' | 'Testnet' | 'Devnet') => void
  setPastelId: (id: string) => void
  setBalance: (balance: number) => void
  setAddresses: (addresses: string[]) => void
  setCreditPacks: (packs: any[]) => void
  initializeWallet: () => Promise<void>
  lockWallet: () => Promise<void>
  unlockWallet: (password: string) => Promise<void>
  createNewAddress: () => Promise<void>
  refreshWalletData: () => Promise<void>
}

const rpc = new BrowserRPCReplacement()

const useStore = create<WalletState & WalletActions>()(
  persist(
    (set, get) => ({
      isLocked: true,
      networkMode: 'Mainnet',
      pastelId: '',
      balance: 0,
      addresses: [],
      creditPacks: [],

      setLocked: (isLocked) => set({ isLocked }),
      setNetworkMode: (mode) => set({ networkMode: mode }),
      setPastelId: (id) => set({ pastelId: id }),
      setBalance: (balance) => set({ balance }),
      setAddresses: (addresses) => set({ addresses }),
      setCreditPacks: (packs) => set({ creditPacks: packs }),

      initializeWallet: async () => {
        await rpc.initialize()
        const networkInfo = await rpc.getNetworkInfo()
        set({ networkMode: networkInfo.network as 'Mainnet' | 'Testnet' | 'Devnet' })
        await get().refreshWalletData()
      },

      lockWallet: async () => {
        await rpc.lockWallet()
        set({ isLocked: true })
      },

      unlockWallet: async (password: string) => {
        try {
          await rpc.unlockWallet(password)
          set({ isLocked: false })
          await get().refreshWalletData()
        } catch (error) {
          console.error('Failed to unlock wallet:', error)
          throw error
        }
      },

      createNewAddress: async () => {
        if (get().isLocked) {
          throw new Error('Wallet is locked')
        }
        const newAddress = await rpc.makeNewAddress(get().networkMode)
        set((state) => ({ addresses: [...state.addresses, newAddress] }))
      },

      refreshWalletData: async () => {
        if (get().isLocked) {
          return
        }
        try {
          const balance = await rpc.getBalance()
          const addresses = await rpc.getAllAddresses(get().networkMode)
          const pastelIDs = await rpc.getAllPastelIDs()
          const creditPacks = await api.getMyValidCreditPacks()

          set({
            balance,
            addresses,
            pastelId: pastelIDs[0] || '',
            creditPacks,
          })
        } catch (error) {
          console.error('Failed to refresh wallet data:', error)
        }
      },
    }),
    {
      name: 'pastel-wallet-storage',
      partialize: (state) => ({
        networkMode: state.networkMode,
        pastelId: state.pastelId,
        addresses: state.addresses,
      }),
    }
  )
)

export default useStore