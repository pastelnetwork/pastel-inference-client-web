import React from 'react'
import { Form, Input, Button, Select } from 'antd'

const { TextArea } = Input
const { Option } = Select

const InferenceForm: React.FC<{ pastelId: string }> = ({ pastelId }) => {
  const [form] = Form.useForm()

  const onFinish = (values: any) => {
    console.log('Form values:', values)
    // Handle form submission
  }

  return (
    <Form form={form} onFinish={onFinish} layout="vertical">
      <Form.Item name="inferenceType" label="Inference Type" rules={[{ required: true }]}>
        <Select>
          <Option value="text_completion">Text Completion</Option>
          <Option value="image_generation">Image Generation</Option>
          {/* Add more options */}
        </Select>
      </Form.Item>
      <Form.Item name="prompt" label="Prompt" rules={[{ required: true }]}>
        <TextArea rows={4} />
      </Form.Item>
      <Form.Item name="maxCost" label="Max Cost (Credits)" rules={[{ required: true }]}>
        <Input type="number" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Submit Inference Request
        </Button>
      </Form.Item>
    </Form>
  )
}

export default InferenceForm