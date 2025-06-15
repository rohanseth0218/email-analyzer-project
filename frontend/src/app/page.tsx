'use client'

import React, { useState, useEffect } from 'react'

interface Deal {
  id: string
  name: string
  status: string
  amount: string
  shopify_domain: string
  trial_start_date: string
}

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('🔄 Starting to fetch deals...')
    
    const fetchDeals = async () => {
      try {
        console.log('📡 Making API request to backend...')
        const response = await fetch('http://localhost:3001/api/deals?limit=10')
        
        console.log('📊 Response status:', response.status)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('✅ Data received:', data)
        
        // Handle different response formats
        const dealsArray = data.data || data.deals || data || []
        console.log('📋 Deals array:', dealsArray.length, 'deals')
        
        setDeals(dealsArray)
        setError(null)
      } catch (err) {
        console.error('❌ Error fetching deals:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch deals')
      } finally {
        setLoading(false)
        console.log('🏁 Fetch complete')
      }
    }

    fetchDeals()
  }, [])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Shopify CRM Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your Shopify app subscription deals and track trial conversions
            </p>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              Deals Dashboard
            </h2>
            
            {loading && (
              <div className="flex items-center justify-center min-h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Loading deals...</span>
              </div>
            )}
            
            {error && (
              <div className="text-center py-8">
                <div className="text-red-600 mb-2">❌ Error: {error}</div>
                <p className="text-sm text-gray-500">
                  Make sure the backend is running on http://localhost:3001
                </p>
              </div>
            )}
            
            {!loading && !error && deals.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No deals found</p>
              </div>
            )}
            
            {!loading && !error && deals.length > 0 && (
              <div>
                <div className="mb-4 text-sm text-green-600">
                  ✅ Successfully loaded {deals.length} deals
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Domain
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deals.slice(0, 10).map((deal, index) => (
                        <tr key={deal.id || index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {deal.name || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              deal.status === 'Subscribed' ? 'bg-green-100 text-green-800' :
                              deal.status === 'Trial' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {deal.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${deal.amount || '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {deal.shopify_domain || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
} 