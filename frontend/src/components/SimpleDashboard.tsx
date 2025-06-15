'use client'

import React, { useState, useEffect } from 'react'

export default function SimpleDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('SimpleDashboard useEffect running...')
    
    const fetchData = async () => {
      try {
        console.log('Making API call...')
        const response = await fetch('http://localhost:3001/api/deals?limit=3')
        console.log('Response received:', response.status)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        console.log('Data received:', result)
        setData(result)
      } catch (err) {
        console.error('Error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Simple Dashboard - Loading...</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Simple Dashboard - Error</h1>
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 text-green-600">Simple Dashboard - Success!</h1>
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-semibold mb-2">API Response:</h2>
        <p>Total deals: {data?.count || 'Unknown'}</p>
        <p>First deal: {data?.data?.[0]?.name || 'No deals'}</p>
      </div>
    </div>
  )
} 