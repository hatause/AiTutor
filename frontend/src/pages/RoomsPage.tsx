import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  TimePicker,
  Typography
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  SearchOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { findFreeRooms } from '../api/rooms-api';
import type { FindRoomQuery, RoomInfo } from '../types';

/* ── Locations hardcoded (match the Java .env LOCATIONS_LIST) ── */
const LOCATIONS = [
  { id: 'corp_a', name: 'Корпус A', floors: [1, 2, 3, 4] },
  { id: 'corp_b', name: 'Корпус B', floors: [1, 2, 3] }
];

const DURATION_OPTIONS = [30, 60, 90, 120];
const TELEGRAM_BOT_URL = 'https://t.me/AiCam228_bot';

const extractApiErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== 'object') {
    return 'Неизвестная ошибка';
  }

  const err = error as {
    message?: string;
    response?: {
      data?: {
        details?: string;
        message?: string;
        error?: string;
      };
    };
  };

  return (
    err.response?.data?.details
    || err.response?.data?.message
    || err.response?.data?.error
    || err.message
    || 'Неизвестная ошибка'
  );
};

const cameraStatusTag = (room: RoomInfo) => {
  if (room.camera_status === 'online' && room.camera_free) {
    return <Tag icon={<VideoCameraOutlined />} color="success">Камера: свободно</Tag>;
  }
  if (room.camera_status === 'online' && !room.camera_free) {
    return <Tag icon={<VideoCameraOutlined />} color="error">Камера: занято</Tag>;
  }
  return <Tag icon={<VideoCameraOutlined />} color="default">Камера: недоступна</Tag>;
};

const RoomsPage = () => {
  const [form] = Form.useForm();
  const [selectedLocation, setSelectedLocation] = useState<string>(LOCATIONS[0].id);

  const searchMutation = useMutation({
    mutationFn: findFreeRooms
  });

  const floors = LOCATIONS.find((l) => l.id === selectedLocation)?.floors ?? [];

  const handleSearch = async () => {
    try {
      const values = await form.validateFields();
      const query: FindRoomQuery = {
        location_id: values.location_id,
        start_at: dayjs(values.date)
          .hour(dayjs(values.time).hour())
          .minute(dayjs(values.time).minute())
          .second(0)
          .toISOString(),
        duration_minutes: values.duration_minutes,
        floor: values.floor,
        filters: {
          min_capacity: values.min_capacity || undefined,
          need_projector: values.need_projector || undefined
        }
      };
      searchMutation.mutate(query);
    } catch {
      /* validation errors shown by antd */
    }
  };

  const result = searchMutation.data;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Header */}
      <Card>
        <Typography.Title level={3}>
          <EnvironmentOutlined /> Поиск свободных кабинетов
        </Typography.Title>
        <Typography.Text type="secondary">
          Данные по камерам обновляются в реальном времени через YOLO-детекцию. Если камера недоступна — показывается только статус по расписанию.
        </Typography.Text>
      </Card>

      {/* Search form */}
      <Card title="Параметры поиска">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            location_id: LOCATIONS[0].id,
            duration_minutes: 60,
            date: dayjs(),
            time: dayjs().startOf('hour').add(1, 'hour'),
            need_projector: false
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="Корпус" name="location_id" rules={[{ required: true }]}>
                <Select
                  onChange={(v) => {
                    setSelectedLocation(v);
                    form.setFieldValue('floor', undefined);
                  }}
                >
                  {LOCATIONS.map((l) => (
                    <Select.Option key={l.id} value={l.id}>
                      {l.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={4}>
              <Form.Item label="Этаж" name="floor">
                <Select allowClear placeholder="Все">
                  {floors.map((f) => (
                    <Select.Option key={f} value={f}>
                      {f} этаж
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={5}>
              <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={4}>
              <Form.Item label="Время" name="time" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={5}>
              <Form.Item label="Длительность" name="duration_minutes" rules={[{ required: true }]}>
                <Select>
                  {DURATION_OPTIONS.map((d) => (
                    <Select.Option key={d} value={d}>
                      {d} мин
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Form.Item label="Мин. вместимость" name="min_capacity">
                <InputNumber min={1} max={500} style={{ width: '100%' }} placeholder="—" />
              </Form.Item>
            </Col>

            <Col xs={12} sm={6}>
              <Form.Item label="Нужен проектор" name="need_projector" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                loading={searchMutation.isPending}
                onClick={handleSearch}
                size="large"
              >
                Найти кабинеты
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* Error */}
      {searchMutation.isError && (
        <Alert
          type="error"
          showIcon
          message="Ошибка поиска"
          description={(
            <Space direction="vertical" size={4}>
              <Typography.Text>{extractApiErrorMessage(searchMutation.error)}</Typography.Text>
              <Typography.Text type="secondary">
                Если вкладка не работает, вы можете перейти к нашему{' '}
                <Typography.Link href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer">
                  Telegram-боту
                </Typography.Link>
                .
              </Typography.Text>
            </Space>
          )}
          action={
            <Button icon={<ReloadOutlined />} onClick={handleSearch}>
              Повторить
            </Button>
          }
        />
      )}

      {/* Results */}
      {result && (
        <>
          {result.reason ? (
            <Alert type="info" showIcon message={result.reason} />
          ) : null}

          {/* Free rooms */}
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                Свободные кабинеты
                <Badge count={result.free_rooms.length} style={{ backgroundColor: '#52c41a' }} />
              </Space>
            }
          >
            {result.free_rooms.length === 0 ? (
              <Empty
                description={(
                  <Space direction="vertical" size={4}>
                    <Typography.Text>Свободных кабинетов не найдено.</Typography.Text>
                    <Typography.Text type="secondary">
                      Вы можете перейти к нашему{' '}
                      <Typography.Link href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer">
                        Telegram-боту
                      </Typography.Link>
                      .
                    </Typography.Text>
                  </Space>
                )}
              />
            ) : (
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
                dataSource={result.free_rooms}
                renderItem={(room) => (
                  <List.Item>
                    <Card size="small" hoverable>
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="Кабинет">
                          <Typography.Text strong>{room.name}</Typography.Text>
                        </Descriptions.Item>
                        {room.floor != null && (
                          <Descriptions.Item label="Этаж">{room.floor}</Descriptions.Item>
                        )}
                        {room.capacity != null && (
                          <Descriptions.Item label="Вместимость">{room.capacity} чел.</Descriptions.Item>
                        )}
                        <Descriptions.Item label="Расписание">
                          {room.schedule_free ? (
                            <Tag color="success">Свободно</Tag>
                          ) : (
                            <Tag color="error">Занято</Tag>
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Камера">{cameraStatusTag(room)}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </Card>

          {/* Alternatives */}
          {result.alternatives.length > 0 && (
            <Card
              title={
                <Space>
                  <CloseCircleOutlined style={{ color: '#faad14' }} />
                  Альтернативы (заняты по камере)
                  <Badge count={result.alternatives.length} style={{ backgroundColor: '#faad14' }} />
                </Space>
              }
            >
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
                dataSource={result.alternatives}
                renderItem={(room) => (
                  <List.Item>
                    <Card size="small">
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="Кабинет">
                          <Typography.Text strong>{room.name}</Typography.Text>
                        </Descriptions.Item>
                        {room.floor != null && (
                          <Descriptions.Item label="Этаж">{room.floor}</Descriptions.Item>
                        )}
                        {room.capacity != null && (
                          <Descriptions.Item label="Вместимость">{room.capacity} чел.</Descriptions.Item>
                        )}
                        <Descriptions.Item label="Камера">{cameraStatusTag(room)}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </>
      )}

    </Space>
  );
};

export default RoomsPage;
