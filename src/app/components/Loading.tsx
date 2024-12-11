import { Spin } from "antd";
import { LoadingOutlined } from '@ant-design/icons';

interface Loading {
  isLoading: boolean;
  className?: string;
  text?: string;
}

export default function Loading({
  isLoading,
  className,
  text,
}: Loading) {
  if (!isLoading) {
    return null;
  }

  return (
    <div className={`${className || ''} flex justify-center items-center`}>
      <Spin indicator={<LoadingOutlined style={{ fontSize: 22 }} spin />} />
      <div className='ml-3 whitespace-nowrap text-sm'>{text || 'Loading'}...</div>
    </div>
  )
}