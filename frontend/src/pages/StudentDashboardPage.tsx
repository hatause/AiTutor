import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Form, List, Row, Select, Space, Spin, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { loadSubjects } from '../api/subjects-api';
import { generateTest } from '../api/tests-api';
import { useAuth } from '../store/auth-store';
import type { SubjectListItem } from '../types';

const StudentDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>();

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => loadSubjects({}),
    enabled: Boolean(user)
  });

  const subjects = useMemo(() => subjectsQuery.data?.items ?? [], [subjectsQuery.data]);

  const generateMutation = useMutation({
    mutationFn: generateTest,
    onSuccess: (result) => {
      navigate(`/tests/${result.testId}`);
    }
  });

  const defaultSubject = selectedSubject ?? subjects[0]?.subjectId;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3}>Дашборд студента</Typography.Title>
        <Typography.Text type="secondary">
          Предметы берутся из удалённого Java-сервера расписания. Выберите предмет и запустите тест.
        </Typography.Text>
      </Card>

      {subjectsQuery.isLoading ? (
        <Card>
          <Spin />
        </Card>
      ) : null}

      {subjectsQuery.error ? <Alert type="error" showIcon message="Не удалось загрузить предметы." /> : null}

      {!subjectsQuery.data?.stale && subjectsQuery.data?.reason ? (
        <Alert type="info" showIcon message={subjectsQuery.data.reason} />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Предметы из расписания">
            <List
              dataSource={subjects}
              locale={{ emptyText: 'Нет предметов' }}
              renderItem={(subject: SubjectListItem) => (
                <List.Item
                  actions={[
                    <Button key="pick" onClick={() => setSelectedSubject(subject.subjectId)}>
                      Выбрать
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={subject.subjectName}
                    description={
                      <Space wrap>
                        {subject.teacher?.name ? <Tag>{subject.teacher.name}</Tag> : null}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Быстрый старт теста">
            <Form
              layout="vertical"
              initialValues={{
                difficulty: 'MEDIUM',
                questionTypes: ['SINGLE_CHOICE', 'MULTI_CHOICE', 'OPEN_SHORT'],
                questionCount: 10,
                language: 'ru'
              }}
              onFinish={(values) => {
                if (!defaultSubject) {
                  return;
                }
                generateMutation.mutate({
                  subjectId: defaultSubject,
                  difficulty: values.difficulty,
                  questionTypes: values.questionTypes,
                  questionCount: values.questionCount,
                  topicIds: values.topicIds ?? [],
                  language: values.language
                });
              }}
            >
              <Form.Item label="Предмет" required>
                <Select
                  value={defaultSubject}
                  onChange={setSelectedSubject}
                  options={subjects.map((s) => ({
                    label: s.subjectName,
                    value: s.subjectId
                  }))}
                />
              </Form.Item>
              <Form.Item label="Сложность" name="difficulty" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'Easy', value: 'EASY' },
                    { label: 'Medium', value: 'MEDIUM' },
                    { label: 'Hard', value: 'HARD' }
                  ]}
                />
              </Form.Item>
              <Form.Item label="Типы вопросов" name="questionTypes" rules={[{ required: true }]}>
                <Select
                  mode="multiple"
                  options={[
                    { label: 'Одиночный выбор', value: 'SINGLE_CHOICE' },
                    { label: 'Множественный выбор', value: 'MULTI_CHOICE' },
                    { label: 'Открытый ответ', value: 'OPEN_SHORT' }
                  ]}
                />
              </Form.Item>
              <Form.Item label="Количество" name="questionCount" rules={[{ required: true }]}>
                <Select options={[5, 10, 15, 20].map((n) => ({ label: n, value: n }))} />
              </Form.Item>
              <Form.Item label="Темы (необязательно)" name="topicIds">
                <Select mode="tags" tokenSeparators={[',']} />
              </Form.Item>
              <Form.Item label="Язык" name="language" rules={[{ required: true }]}>
                <Select options={[{ label: 'Русский', value: 'ru' }, { label: 'English', value: 'en' }]} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={generateMutation.isPending} block disabled={!defaultSubject}>
                Сгенерировать тест
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default StudentDashboardPage;
