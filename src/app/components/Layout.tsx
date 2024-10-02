import React from 'react'
import { Layout as AntLayout, Menu } from 'antd'
import { 
  HomeOutlined, 
  DollarOutlined, 
  ApiOutlined 
} from '@ant-design/icons'

const { Header, Content, Footer } = AntLayout

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AntLayout className="min-h-screen">
      <Header>
        <div className="logo" />
        <Menu theme="dark" mode="horizontal" defaultSelectedKeys={['1']}>
          <Menu.Item key="1" icon={<HomeOutlined />}>
            Home
          </Menu.Item>
          <Menu.Item key="2" icon={<DollarOutlined />}>
            Credit Packs
          </Menu.Item>
          <Menu.Item key="3" icon={<ApiOutlined />}>
            Inference
          </Menu.Item>
        </Menu>
      </Header>
      <Content className="p-8">
        <div className="bg-white p-6 min-h-[280px]">
          {children}
        </div>
      </Content>
      <Footer className="text-center">
        Pastel Inference Client ©{new Date().getFullYear()} Created with Next.js 14
      </Footer>
    </AntLayout>
  )
}

export default Layout