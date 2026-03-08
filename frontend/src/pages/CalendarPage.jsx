import { useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin   from '@fullcalendar/daygrid';
import timeGridPlugin  from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from '../components/training/AddTrainingModal';

const COLORS = {
  Gym:        '#2563EB',
  Cardio:     '#059669',
  HIIT:       '#DC2626',
  Bodyweight: '#7C3AED',
  Custom:     '#D97706',
};

export default function CalendarPage() {
  const calRef        = useRef(null);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTraining, setEditTraining] = useState(null);
  const [initTime,    setInitTime]    = useState(null);

  // FullCalendar fetches events via this function
  async function fetchEvents(fetchInfo, successCallback, failureCallback) {
    try {
      const { data } = await trainingService.getCalendar(
        fetchInfo.startStr,
        fetchInfo.endStr
      );
      successCallback(
        data.map((t) => ({
          id:              t.id,
          title:           t.title || `${t.first_name} — ${t.workout_type}`,
          start:           t.start_time,
          end:             t.end_time,
          backgroundColor: t.is_completed
            ? '#6B7280'
            : (COLORS[t.workout_type] || '#2563EB'),
          borderColor:     'transparent',
          extendedProps:   t,
        }))
      );
    } catch (e) {
      failureCallback(e);
    }
  }

  function handleDateClick(info) {
    setEditTraining(null);
    setInitTime(info.dateStr);
    setModalOpen(true);
  }

  async function handleEventClick(info) {
    try {
      const { data } = await trainingService.getById(info.event.id);
      setEditTraining(data);
      setInitTime(null);
      setModalOpen(true);
    } catch { /* ignore */ }
  }

  async function handleEventDrop(info) {
    try {
      await trainingService.update(info.event.id, {
        startTime: info.event.startStr,
        endTime:   info.event.endStr || info.event.startStr,
      });
    } catch {
      info.revert();
    }
  }

  async function handleEventResize(info) {
    try {
      await trainingService.update(info.event.id, {
        startTime: info.event.startStr,
        endTime:   info.event.endStr,
      });
    } catch {
      info.revert();
    }
  }

  function refetch() {
    calRef.current?.getApi().refetchEvents();
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <button
          onClick={() => { setEditTraining(null); setInitTime(null); setModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium text-sm"
        >
          + Add Training
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-500">{type}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-xs text-gray-500">Completed</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  isMobile ? 'timeGridDay,dayGridMonth' : 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={fetchEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          editable={!isMobile}
          selectable={true}
          height="auto"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        />
      </div>

      <AddTrainingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); refetch(); }}
        initialStartTime={initTime}
        editTraining={editTraining}
      />
    </div>
  );
}
