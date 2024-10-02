import React from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

interface CreditPack {
  id: string
  credits: number
  balance: number
  address: string
  blockHeight: number
  txid: string
}

const columns: ColumnsType<CreditPack> = [
  {
    title: 'Credits',
    dataIndex: 'credits',
    key: 'credits',
  },
  {
    title: 'Balance',
    dataIndex: 'balance',
    key: 'balance',
  },
  {
    title: 'Address',
    dataIndex: 'address',
    key: 'address',
  },
  {
    title: 'Block Height',
    dataIndex: 'blockHeight',
    key: 'blockHeight',
  },
  {
    title: 'TXID',
    dataIndex: 'txid',
    key: 'txid',
  },
]

const CreditPackTable: React.FC<{ creditPacks: CreditPack[] }> = ({ creditPacks }) => (
  <Table columns={columns} dataSource={creditPacks} rowKey="id" />
)

export default CreditPackTable