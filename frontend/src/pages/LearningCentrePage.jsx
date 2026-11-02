import { get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { number, relative } from '../lib/format'
import { Card, CardHead, Empty, ErrorNote, PageHead, Progress, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'

export default function LearningCentrePage() {
  const { session } = useSession()
  const learning = useApi(() => get('/api/learning-centre'), 'learning')
  const data = learning.data
  const summary = data?.summary
  const courses = data?.courses || []
  const mine = data?.myLearning || []

  return (
    <div className="stack">
      <PageHead title="Learning centre" description={`${session?.locationName || ''} · courses, quizzes and practical training.`} />

      <div className="grid grid-4">
        <Stat label="Assigned" value={number(summary?.assigned)} />
        <Stat label="Outstanding" value={number(summary?.outstanding)} tone={summary?.outstanding ? 'warn' : undefined} />
        <Stat label="Completed" value={number(summary?.completed)} tone="ok" />
        <Stat label="Overdue" value={number(summary?.overdue)} tone={summary?.overdue ? 'danger' : undefined} />
      </div>

      <ErrorNote error={learning.error} onRetry={learning.reload} />
      {learning.loading ? <Spinner label="Loading learning" /> : null}

      <div className="grid grid-2">
        <Card>
          <CardHead title="Your learning" subtitle="Assigned to you" />
          {!mine.length && !learning.loading ? <Empty title="Nothing assigned">New training appears here when it is assigned.</Empty> : null}
          {mine.map((entry) => (
            <div className="list-row" key={entry.id || entry.courseId}>
              <Icon name="graduation" size={17} />
              <div className="list-main">
                <strong>{entry.title || entry.courseName}</strong>
                <small>{entry.status || 'assigned'}{entry.dueAt ? ` · due ${relative(entry.dueAt)}` : ''}</small>
              </div>
              <div style={{ width: 110 }}>
                <Progress value={entry.progressPercent || 0} />
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <CardHead title="Course library" subtitle={`${number(courses.length)} courses`} />
          {!courses.length && !learning.loading ? <Empty title="No courses yet">Published courses show up here.</Empty> : null}
          {courses.map((course) => (
            <div className="list-row" key={course.id}>
              <div className="list-main">
                <strong>{course.title}</strong>
                <small>
                  {course.status || 'published'}
                  {course.sectionCount ? ` · ${number(course.sectionCount)} sections` : ''}
                </small>
              </div>
              {course.assignedCount != null ? <span className="badge">{number(course.assignedCount)} assigned</span> : null}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
