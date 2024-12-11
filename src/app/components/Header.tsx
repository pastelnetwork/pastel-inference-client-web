// src/app/components/Header.tsx

'use client'

import { useState, useEffect } from 'react'
import { getNetworkInfo } from '../lib/api'

export default function Header() {
  const [network, setNetwork] = useState<string>('')
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const fetchNetworkInfo = async () => {
      const info = await getNetworkInfo()
      setNetwork(info.network)
    }
    fetchNetworkInfo()

    const storedTheme = localStorage.getItem('theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setIsDarkMode(storedTheme === 'dark')
    document.documentElement.setAttribute('data-theme', storedTheme)
  }, [])

  const toggleDarkMode = () => {
    const newTheme = isDarkMode ? 'light' : 'dark'
    setIsDarkMode(!isDarkMode)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <div className="flex gap-6 justify-between sm:justify-start sm:items-center sticky top-0 p-4 bg-bw-50 z-10 ground-glass shadow-md" id="title">
      <h1 className="text-2xl md:text-4xl font-bold text-bw-600 sm:flex gap-1 sm:items-center sm:flex-row flex-col">
        <span>Pastel Inference Client</span>
        <span id="networkName" className="text-lg md:text-xl font-normal align-middle"> ({network})</span>
      </h1>
      <input
        id="theme-toggle"
        className="switch success lg w-14 min-w-14"
        data-content={isDarkMode ? "🌙" : "☀"}
        type="checkbox"
        checked={isDarkMode}
        onChange={toggleDarkMode}
      />
    </div>
  )
}