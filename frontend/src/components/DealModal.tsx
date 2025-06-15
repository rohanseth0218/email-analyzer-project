'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Deal } from './DealsDashboard'

interface DealModalProps {
  isOpen: boolean
  onClose: () => void
  deal: Deal | null
  mode: 'view' | 'edit' | 'create'
  onSave: (data: Partial<Deal>) => void
}

export default function DealModal({ isOpen, onClose, deal, mode, onSave }: DealModalProps) {
  const [formData, setFormData] = useState<Partial<Deal>>({
    name: '',
    workspace_id: '',
    shopify_domain: '',
    status: 'Trial',
    trial_start_date: '',
    amount: '0',
    churn_date: '',
    trial_length: 14,
    platform: 'Shopify',
    esp: 'Klaviyo',
    billing: 'Shopify'
  })

  useEffect(() => {
    if (deal && (mode === 'edit' || mode === 'view')) {
      setFormData({
        ...deal,
        trial_start_date: deal.trial_start_date ? deal.trial_start_date.split('T')[0] : '',
        churn_date: deal.churn_date ? deal.churn_date.split('T')[0] : ''
      })
    } else if (mode === 'create') {
      setFormData({
        name: '',
        workspace_id: '',
        shopify_domain: '',
        status: 'Trial',
        trial_start_date: '',
        amount: '0',
        churn_date: '',
        trial_length: 14,
        platform: 'Shopify',
        esp: 'Klaviyo',
        billing: 'Shopify'
      })
    }
  }, [deal, mode])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'view') return
    
    const submitData = {
      ...formData,
      amount: formData.amount?.toString() || '0',
      trial_length: Number(formData.trial_length) || 14
    }
    
    onSave(submitData)
  }

  const handleInputChange = (field: keyof Deal, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const isReadOnly = mode === 'view'
  const title = mode === 'create' ? 'Create Deal' : mode === 'edit' ? 'Edit Deal' : 'View Deal'

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {title}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deal Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        readOnly={isReadOnly}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Workspace ID *
                      </label>
                      <input
                        type="text"
                        value={formData.workspace_id || ''}
                        onChange={(e) => handleInputChange('workspace_id', e.target.value)}
                        readOnly={isReadOnly}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Shopify Domain
                      </label>
                      <input
                        type="text"
                        value={formData.shopify_domain || ''}
                        onChange={(e) => handleInputChange('shopify_domain', e.target.value)}
                        readOnly={isReadOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status || 'Trial'}
                        onChange={(e) => handleInputChange('status', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="Trial">Trial</option>
                        <option value="Subscribed">Subscribed</option>
                        <option value="Churn">Churn</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount || '0'}
                        onChange={(e) => handleInputChange('amount', e.target.value)}
                        readOnly={isReadOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Trial Length (days)
                      </label>
                      <input
                        type="number"
                        value={formData.trial_length || 14}
                        onChange={(e) => handleInputChange('trial_length', parseInt(e.target.value))}
                        readOnly={isReadOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Trial Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.trial_start_date || ''}
                        onChange={(e) => handleInputChange('trial_start_date', e.target.value)}
                        readOnly={isReadOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Churn Date
                      </label>
                      <input
                        type="date"
                        value={formData.churn_date || ''}
                        onChange={(e) => handleInputChange('churn_date', e.target.value)}
                        readOnly={isReadOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Platform
                      </label>
                      <select
                        value={formData.platform || 'Shopify'}
                        onChange={(e) => handleInputChange('platform', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="Shopify">Shopify</option>
                        <option value="WooCommerce">WooCommerce</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ESP
                      </label>
                      <select
                        value={formData.esp || 'Klaviyo'}
                        onChange={(e) => handleInputChange('esp', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="Klaviyo">Klaviyo</option>
                        <option value="Mailchimp">Mailchimp</option>
                        <option value="Sendlane">Sendlane</option>
                        <option value="Omnisend">Omnisend</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Billing
                      </label>
                      <select
                        value={formData.billing || 'Shopify'}
                        onChange={(e) => handleInputChange('billing', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="Shopify">Shopify</option>
                        <option value="Stripe">Stripe</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-6 border-t">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {mode === 'view' ? 'Close' : 'Cancel'}
                    </button>
                    {mode !== 'view' && (
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {mode === 'create' ? 'Create Deal' : 'Save Changes'}
                      </button>
                    )}
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
} 