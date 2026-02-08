import { useState, useEffect } from 'react';
import { trainingLogsAPI } from '../services/api';

const TrainingLogModal = ({ session, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [loadingLog, setLoadingLog] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    notes: '',
    durationMinutes: '',
    exercises: []
  });

  useEffect(() => {
    if (session?.id) {
      loadExistingLog();
    } else {
      setLoadingLog(false);
    }
  }, [session]);

  const loadExistingLog = async () => {
    try {
      setLoadingLog(true);
      const response = await trainingLogsAPI.getBySession(session.id);
      const log = response.data.trainingLog;
      
      setFormData({
        notes: log.notes || '',
        durationMinutes: log.duration_minutes || '',
        exercises: log.exercises.map(ex => ({
          exerciseName: ex.exercise_name,
          sets: ex.sets || '',
          reps: ex.reps || '',
          weight: ex.weight || '',
          weightUnit: ex.weight_unit || 'kg',
          durationMinutes: ex.duration_minutes || '',
          distance: ex.distance || '',
          distanceUnit: ex.distance_unit || 'km',
          notes: ex.notes || ''
        }))
      });
    } catch (err) {
      // Log doesn't exist yet, that's fine
      if (err.response?.status !== 404) {
        console.error('Error loading log:', err);
      }
    } finally {
      setLoadingLog(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleExerciseChange = (index, field, value) => {
    const newExercises = [...formData.exercises];
    newExercises[index] = {
      ...newExercises[index],
      [field]: value
    };
    setFormData({
      ...formData,
      exercises: newExercises
    });
    setError('');
  };

  const addExercise = () => {
    setFormData({
      ...formData,
      exercises: [
        ...formData.exercises,
        {
          exerciseName: '',
          sets: '',
          reps: '',
          weight: '',
          weightUnit: 'kg',
          durationMinutes: '',
          distance: '',
          distanceUnit: 'km',
          notes: ''
        }
      ]
    });
  };

  const removeExercise = (index) => {
    const newExercises = formData.exercises.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      exercises: newExercises
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await trainingLogsAPI.save(session.id, formData);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save training log');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this training log?')) {
      return;
    }

    setLoading(true);
    try {
      await trainingLogsAPI.delete(session.id);
      onSave();
    } catch (err) {
      setError('Failed to delete training log');
      setLoading(false);
    }
  };

  if (loadingLog) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full p-6">
          <div className="text-center py-12 text-gray-500">Loading training log...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full p-6 my-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Log Training Session
        </h2>
        
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            <strong>Client:</strong> {session.clientName}
          </div>
          <div className="text-sm text-gray-600">
            <strong>Date:</strong> {session.sessionDate} | {session.startTime} - {session.endTime}
          </div>
          {session.sessionType && (
            <div className="text-sm text-gray-600">
              <strong>Type:</strong> {session.sessionType}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session Notes and Duration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="durationMinutes" className="block text-sm font-medium text-gray-700 mb-2">
                Actual Duration (minutes)
              </label>
              <input
                type="number"
                id="durationMinutes"
                name="durationMinutes"
                value={formData.durationMinutes}
                onChange={handleChange}
                min="1"
                className="input"
                placeholder="60"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Session Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="input"
              placeholder="Overall session notes, client feedback, observations..."
            />
          </div>

          {/* Exercises */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Exercises</h3>
              <button
                type="button"
                onClick={addExercise}
                className="btn-secondary text-sm"
              >
                + Add Exercise
              </button>
            </div>

            {formData.exercises.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                No exercises added yet. Click "Add Exercise" to start logging.
              </div>
            ) : (
              <div className="space-y-4">
                {formData.exercises.map((exercise, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-medium text-gray-700">Exercise {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeExercise(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={exercise.exerciseName}
                          onChange={(e) => handleExerciseChange(index, 'exerciseName', e.target.value)}
                          placeholder="Exercise name (e.g., Bench Press)"
                          className="input"
                          required
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          value={exercise.sets}
                          onChange={(e) => handleExerciseChange(index, 'sets', e.target.value)}
                          placeholder="Sets"
                          min="1"
                          className="input"
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          value={exercise.reps}
                          onChange={(e) => handleExerciseChange(index, 'reps', e.target.value)}
                          placeholder="Reps"
                          min="1"
                          className="input"
                        />
                      </div>

                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={exercise.weight}
                          onChange={(e) => handleExerciseChange(index, 'weight', e.target.value)}
                          placeholder="Weight"
                          step="0.5"
                          min="0"
                          className="input flex-1"
                        />
                        <select
                          value={exercise.weightUnit}
                          onChange={(e) => handleExerciseChange(index, 'weightUnit', e.target.value)}
                          className="input w-20"
                        >
                          <option value="kg">kg</option>
                          <option value="lbs">lbs</option>
                        </select>
                      </div>

                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={exercise.distance}
                          onChange={(e) => handleExerciseChange(index, 'distance', e.target.value)}
                          placeholder="Distance (cardio)"
                          step="0.1"
                          min="0"
                          className="input flex-1"
                        />
                        <select
                          value={exercise.distanceUnit}
                          onChange={(e) => handleExerciseChange(index, 'distanceUnit', e.target.value)}
                          className="input w-20"
                        >
                          <option value="km">km</option>
                          <option value="miles">mi</option>
                          <option value="m">m</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <input
                          type="number"
                          value={exercise.durationMinutes}
                          onChange={(e) => handleExerciseChange(index, 'durationMinutes', e.target.value)}
                          placeholder="Duration (minutes, for cardio)"
                          min="1"
                          className="input"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <textarea
                          value={exercise.notes}
                          onChange={(e) => handleExerciseChange(index, 'notes', e.target.value)}
                          placeholder="Exercise notes..."
                          rows={2}
                          className="input"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex space-x-3 pt-4 border-t">
            {formData.exercises.length > 0 && (
              <button
                type="button"
                onClick={handleDelete}
                className="btn-danger"
                disabled={loading}
              >
                Delete Log
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Training Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TrainingLogModal;
