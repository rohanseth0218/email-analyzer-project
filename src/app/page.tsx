'use client'

import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Input, Select, Spin, Avatar, Tag, Button, Space, Typography } from 'antd'
import { SearchOutlined, UserOutlined, DollarOutlined, CalendarOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons'

const { Title, Text } = Typography
const { Search } = Input
const { Option } = Select

interface Deal {
  id: number
  company_name: string
  contact_name: string
  email: string
  phone: string
  deal_value: number
  status: string
  created_at: string
  churn_date?: string
}

export default function CRMDashboard() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchDeals()
  }, [])

  const fetchDeals = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:3001/api/deals')
      if (!response.ok) {
        throw new Error('Failed to fetch deals')
      }
      const data = await response.json()
      setDeals(data)
    } catch (error) {
      console.error('Error fetching deals:', error)
    } finally {
      setLoading(false)
    }
  }

  // Categorize deals
  const categorizeDeals = () => {
    const trial = deals.filter(deal => deal.status === 'Trial')
    const subscribed = deals.filter(deal => deal.status === 'Subscribed')
    const churned = deals.filter(deal => deal.churn_date)
    
    return { trial, subscribed, churned }
  }

  // Filter deals based on search and status
  const filterDeals = (dealsList: Deal[]) => {
    return dealsList.filter(deal => {
      const matchesSearch = deal.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           deal.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           deal.email.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'trial' && deal.status === 'Trial') ||
                           (statusFilter === 'subscribed' && deal.status === 'Subscribed') ||
                           (statusFilter === 'churned' && deal.churn_date)
      
      return matchesSearch && matchesStatus
    })
  }

  const { trial, subscribed, churned } = categorizeDeals()
  const filteredTrials = filterDeals(trial)
  const filteredSubscribed = filterDeals(subscribed)
  const filteredChurned = filterDeals(churned)

  // Calculate statistics
  const totalRevenue = subscribed.reduce((sum, deal) => sum + (deal.deal_value || 0), 0)
  const avgDealValue = deals.length > 0 ? deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0) / deals.length : 0

  const getStatusColor = (status: string, hasChurnDate: boolean) => {
    if (hasChurnDate) return 'red'
    if (status === 'Trial') return 'orange'
    if (status === 'Subscribed') return 'green'
    return 'default'
  }

  const getStatusText = (deal: Deal) => {
    if (deal.churn_date) return 'Churned'
    return deal.status
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const DealCard = ({ deal }: { deal: Deal }) => (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      hoverable
      actions={[
        <Button type="text" icon={<PhoneOutlined />} key="call">Call</Button>,
        <Button type="text" icon={<MailOutlined />} key="email">Email</Button>,
        <Button type="text" key="view">View Details</Button>
      ]}
    >
      <Card.Meta
        avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>{deal.company_name}</Text>
            <Tag color={getStatusColor(deal.status, !!deal.churn_date)}>
              {getStatusText(deal)}
            </Tag>
          </div>
        }
        description={
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">{deal.contact_name}</Text>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">{deal.email}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: '#52c41a' }}>
                {formatCurrency(deal.deal_value || 0)}
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {formatDate(deal.created_at)}
              </Text>
            </div>
            {deal.churn_date && (
              <div style={{ marginTop: 8 }}>
                <Text type="danger" style={{ fontSize: '12px' }}>
                  Churned: {formatDate(deal.churn_date)}
                </Text>
              </div>
            )}
          </div>
        }
      />
    </Card>
  )

  const StageColumn = ({ title, deals, color }: { title: string, deals: Deal[], color: string }) => (
    <Col xs={24} sm={24} md={8} lg={8}>
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0, color }}>
              {title}
            </Title>
            <Tag color={color} style={{ fontSize: '14px', padding: '4px 12px' }}>
              {deals.length}
            </Tag>
          </div>
        }
        style={{ height: '80vh', overflow: 'auto' }}
      >
                 {deals.map(deal => (
           <DealCard deal={deal} key={deal.id} />
         ))}
        {deals.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            No deals in this stage
          </div>
        )}
      </Card>
    </Col>
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, marginBottom: '16px' }}>
          CRM Dashboard
        </Title>
        
        {/* Statistics Cards */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Total Deals"
                value={deals.length}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Active Revenue"
                value={totalRevenue}
                prefix={<DollarOutlined />}
                formatter={(value) => formatCurrency(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Avg Deal Value"
                value={avgDealValue}
                prefix={<DollarOutlined />}
                formatter={(value) => formatCurrency(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Conversion Rate"
                value={deals.length > 0 ? ((subscribed.length / deals.length) * 100) : 0}
                suffix="%"
                precision={1}
              />
            </Card>
          </Col>
        </Row>

        {/* Search and Filter Controls */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="Search companies, contacts, or emails..."
              allowClear
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="all">All Statuses</Option>
              <Option value="trial">Trial</Option>
              <Option value="subscribed">Subscribed</Option>
              <Option value="churned">Churned</Option>
            </Select>
          </Col>
          <Col xs={24} sm={24} md={8}>
            <Space>
              <Button onClick={fetchDeals}>Refresh</Button>
              <Text type="secondary">
                Last updated: {new Date().toLocaleTimeString()}
              </Text>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Deal Stages Columns */}
      <Row gutter={16}>
        <StageColumn 
          title="Trial" 
          deals={filteredTrials} 
          color="#fa8c16" 
        />
        <StageColumn 
          title="Subscribed" 
          deals={filteredSubscribed} 
          color="#52c41a" 
        />
        <StageColumn 
          title="Churned" 
          deals={filteredChurned} 
          color="#ff4d4f" 
        />
      </Row>
    </div>
  )
} 