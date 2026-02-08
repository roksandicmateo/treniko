import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { clientsAPI, trainingLogsAPI } from '../services/api';
import { format } from 'date-fns';
import TrainingLogModal from '../components/TrainingLogModal';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [completionStats, setCompletionStats] = useState(null);
  const [exerciseStats, setExerciseStats] = useState([]);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    loadClient();
    loadCompletionStats();
    loadExerciseStats();
  }, [id]);

  const loadClient = async () => {
    try {
      setLoading(true);
      const response = await clientsAPI.getById(id);
      setClient(response.data.client);
      setError('');
    } catch (err) {
      setError('Failed to load client details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompletionStats = async () => {
    try {
      const response = await trainingLogsAPI.getCompletionStats(id);
      setCompletionStats(response.data.completionStats);
    } catch (err) {
      console.error('Failed to load completion stats:', err);
    }
  };

  const loadExerciseStats = async () => {
    try {
      const response = await trainingLogsAPI.getExerciseStats(id);
      setExerciseStats(response.data.exerciseStats);
    } catch (err) {
      console.error('Failed to load exercise stats:', err);
    }
  };

  const handleEdit = () => {
    navigate('/dashboard/clients', { state: { editClientId: id } });
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client? This will also delete all their training sessions.')) {
      return;
    }

    try {
      await clientsAPI.delete(id);
      navigate('/dashboard/clients');
    } catch (err) {
      alert('Failed to delete client');
      console.error(err);
    }
  };

  const handleLogTraining = (session) => {
    setSelectedSession(session);
    setLogModalOpen(true);
  };

  const handleLogSaved = () => {
    setLogModalOpen(false);
    setSelectedSession(null);
    loadClient();
    loadCompletionStats();
    loadExerciseStats();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading client details...</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-lg">
          {error || 'Client not found'}
        </div>
        <Link to="/dashboard/clients" className="btn-secondary mt-4 inline-block">
          ← Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/dashboard/clients" className="text-primary-600 hover:text-primary-700 mb-4 inline-block">
          ← Back to Clients
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {client.first_name} {client.last_name}
            </h1>
            <div className="mt-2 flex items-center space-x-4">
              {client.is_active ? (
                <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
                  Active
                </span>
              ) : (
                <span className="px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800 rounded-full">
                  Inactive
                </span>
              )}
              <span className="text-sm text-gray-500">
                Client since {format(new Date(client.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          <div className="flex space-x-3">
            <button onClick={handleEdit} className="btn-secondary">
              Edit
            </button>
            <button onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-gray-600">Total Sessions</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {client.total_sessions || 0}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600">Completed</div>
          <div className="text-3xl font-bold text-green-600 mt-1">
            {completionStats?.completed_sessions || 0}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600">Completion Rate</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">
            {completionStats?.completion_rate || 0}%
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600">Last Training</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {client.last_session_date 
              ? format(new Date(client.last_session_date), 'MMM d, yyyy')
              : 'Never'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'upcoming'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Upcoming Sessions ({client.upcoming_sessions?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Training History
          </button>
          <button
            onClick={() => setActiveTab('exercises')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'exercises'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Exercise Stats
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{client.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{client.phone || '—'}</dd>
                </div>
              </dl>
            </div>

            {client.next_session_date && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Next Session</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-900 font-medium">
                    {format(new Date(client.next_session_date), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            )}

            {completionStats && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Training Completion</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{completionStats.total_sessions}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{completionStats.completed_sessions}</div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{completionStats.missed_sessions}</div>
                    <div className="text-sm text-gray-600">Missed</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'upcoming' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Sessions</h3>
            {client.upcoming_sessions && client.upcoming_sessions.length > 0 ? (
              <div className="space-y-3">
                {client.upcoming_sessions.map((session) => (
                  <div key={session.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {format(new Date(session.session_date), 'EEEE, MMMM d, yyyy')}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {session.start_time} - {session.end_time}
                        </div>
                        {session.session_type && (
                          <div className="text-sm text-gray-600 mt-1">
                            Type: {session.session_type}
                          </div>
                        )}
                        {session.notes && (
                          <div className="text-sm text-gray-600 mt-2">
                            {session.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No upcoming sessions scheduled</p>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Training Sessions</h3>
            {client.recent_sessions && client.recent_sessions.length > 0 ? (
              <div className="space-y-3">
                {client.recent_sessions.map((session) => (
                  <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {format(new Date(session.session_date), 'EEEE, MMMM d, yyyy')}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {session.start_time} - {session.end_time}
                        </div>
                        {session.session_type && (
                          <div className="text-sm text-gray-600 mt-1">
                            Type: {session.session_type}
                          </div>
                        )}
                        {session.notes && (
                          <div className="text-sm text-gray-600 mt-2">
                            {session.notes}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => handleLogTraining({
                            id: session.id,
                            clientName: `${client.first_name} ${client.last_name}`,
                            sessionDate: session.session_date,
                            startTime: session.start_time,
                            endTime: session.end_time,
                            sessionType: session.session_type
                          })}
                          className="btn-primary text-sm"
                        >
                          Log Training
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No training history yet</p>
            )}
          </div>
        )}

        {activeTab === 'exercises' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Exercise Statistics</h3>
            {exerciseStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Exercise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Times Performed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Max Weight
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Avg Weight
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Last Performed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {exerciseStats.map((stat, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {stat.exercise_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {stat.total_times_performed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {stat.max_weight ? `${stat.max_weight} kg` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {stat.avg_weight ? `${parseFloat(stat.avg_weight).toFixed(1)} kg` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {format(new Date(stat.last_performed), 'MMM d, yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No exercise data yet. Start logging training sessions!</p>
            )}
          </div>
        )}
      </div>

      {/* Training Log Modal */}
      {logModalOpen && (
        <TrainingLogModal
          session={selectedSession}
          onClose={() => {
            setLogModalOpen(false);
            setSelectedSession(null);
          }}
          onSave={handleLogSaved}
        />
      )}
    </div>
  );
};

export default ClientDetail;
