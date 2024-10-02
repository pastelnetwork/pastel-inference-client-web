'use client'

import { useEffect } from 'react'
import { Typography } from 'antd'
import CreditPackTable from '@/components/CreditPackTable'
import InferenceForm from '@/components/InferenceForm'
import useStore from '@/store/useStore'

const { Title } = Typography

export default function Home() {
  const { pastelId, setPastelId, creditPacks, setCreditPacks } = useStore()

  useEffect(() => {
    // Fetch initial data
    // This is where you'd call your API to get PastelID, credit packs, etc.
  }, [])

  return (
    <main>
      <Title>Welcome to Pastel Inference Client</Title>
      <CreditPackTable creditPacks={creditPacks} />
      <InferenceForm pastelId={pastelId} />
    </main>
  )
}