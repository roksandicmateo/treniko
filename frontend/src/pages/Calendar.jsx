import { useState, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { sessionsAPI } from '../services/api';
import SessionModal from '../components/SessionModal';
import { format } from 'date-fns';

const STATUS_COLORS = {
  completed: { bg: '#22c55e', border: '#16a34a' },
  cancelled: { bg: '#cbd5e1', border: '#94a3b8' },
  no_show:   { bg: '#f87171', border: '#ef4444' },
  scheduled: { bg: '#38bdf8', border: '#0ea5e9' },
};

const LEGEND = [
  { label: 'Scheduled', color: '#38bdf8' },
  { label: 'Completed', color: '#22c55e' },
  { label: 'No-show',   color: '#f87171' },
  { label: 'Cancelled', color: '#cbd5e1' },
];

export default function Calendar() {
  const calRef = useRef(null);
  const mobile = window.innerWidth < 640;

  const [currentView, setCurrentView] = useState(mobile ? 'timeGridDay' : 'timeGridWeek');
  const [title,       setTitle]       = useState('');
  const [modalOpen,       setModalOpen]       = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDate,    setSelectedDate]    = useState(null);
  const [selectedTime,    setSelectedTime]    = useState(null);

  // FC manages fetch lifecycle — no infinite loop
  const fetchEvents = useCallback(async (fetchInfo, successCallback, failureCallback) => {
    try {
      const start = format(fetchInfo.start, 'yyyy-MM-dd');
      const end   = format(fetchInfo.end,   'yyyy-MM-dd');
      const response = await sessionsAPI.getAll({ startDate: start, endDate: end });
      successCallback(
        response.data.sessions.map(session => {
          const dateOnly = session.session_date.split('T')[0];
          const colors   = STATUS_COLORS[session.status] || STATUS_COLORS.scheduled;
          return {
            id:              session.id,
            title:           `${session.client_first_name} ${session.client_last_name}`,
            start:           `${dateOnly}T${session.start_time.slice(0, 5)}`,
            end:             `${dateOnly}T${session.end_time.slice(0, 5)}`,
            backgroundColor: colors.bg,
            borderColor:     colors.border,
            textColor:       session.status === 'cancelled' ? '#64748b' : '#ffffff',
            extendedProps: {
              clientId:    session.client_id,
              sessionType: session.session_type,
              notes:       session.notes,
              isCompleted: session.is_completed,
              sessionDate: dateOnly,
              startTime:   session.start_time,
              endTime:     session.end_time,
              status:      session.status || 'scheduled',
            },
          };
        })
      );
    } catch (e) { failureCallback(e); }
  }, []);

  const handleDatesSet   = (arg) => setTitle(arg.view.title);
  const handleDateClick  = (arg) => {
    setSelectedSession(null);
    setSelectedDate(arg.dateStr.split('T')[0]);
    setSelectedTime(arg.date);
    setModalOpen(true);
  };
  const handleEventClick = (arg) => {
    const e = arg.event;
    setSelectedSession({
      id: e.id, clientId: e.extendedProps.clientId,
      sessionDate: e.extendedProps.sessionDate,
      startTime: e.extendedProps.startTime, endTime: e.extendedProps.endTime,
      sessionType: e.extendedProps.sessionType, notes: e.extendedProps.notes,
      isCompleted: e.extendedProps.isCompleted, status: e.extendedProps.status,
      clientName: e.title,
    });
    setSelectedDate(null); setSelectedTime(null);
    setModalOpen(true);
  };
  const handleSave = () => {
    setModalOpen(false); setSelectedSession(null);
    calRef.current?.getApi().refetchEvents();
  };

  const go = (action) => {
    const api = calRef.current?.getApi();
    if (!api) return;
    if (action === 'prev')  api.prev();
    if (action === 'next')  api.next();
    if (action === 'today') api.today();
  };

  const changeView = (v) => {
    calRef.current?.getApi().changeView(v);
    setCurrentView(v);
  };

  const viewOptions = mobile
    ? [{ id: 'timeGridDay', label: 'Day' }, { id: 'dayGridMonth', label: 'Month' }]
    : [{ id: 'timeGridDay', label: 'Day' }, { id: 'timeGridWeek', label: 'Week' }, { id: 'dayGridMonth', label: 'Month' }];

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Schedule</h1>
          <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Click a slot to create · Click a session to edit</p>
        </div>
        <button
          onClick={() => {
            setSelectedSession(null);
            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
            setSelectedTime(new Date());
            setModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold text-sm shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span> Session
        </button>
      </div>

      {/* Calendar card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 bg-white">

          {/* Left: nav buttons */}
          <div className="flex items-center gap-1">
            <button onClick={() => go('prev')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors font-bold text-lg">
              ‹
            </button>
            <button onClick={() => go('today')}
              className="h-8 px-3 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors text-xs font-semibold">
              Today
            </button>
            <button onClick={() => go('next')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors font-bold text-lg">
              ›
            </button>
          </div>

          {/* Center: title */}
          <span className="text-sm font-semibold text-gray-700 hidden sm:block select-none">{title}</span>

          {/* Right: view switcher */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
            {viewOptions.map(v => (
              <button key={v.id} onClick={() => changeView(v.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentView === v.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile title */}
        {mobile && title && (
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100 text-center">
            {title}
          </div>
        )}

        {/* Calendar */}
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={currentView}
          timeZone="UTC"
          headerToolbar={false}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          editable={false}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={3}
          weekends={true}
          events={fetchEvents}
          select={handleDateClick}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventContent={(arg) => {
            const type = arg.event.extendedProps.sessionType;
            return (
              <div className="px-2 py-1 w-full overflow-hidden h-full">
                <div className="text-xs font-bold leading-tight truncate">{arg.timeText}</div>
                <div className="text-xs leading-tight truncate font-semibold opacity-95">{arg.event.title}</div>
                {type && <div className="text-xs leading-tight truncate opacity-75">{type}</div>}
              </div>
            );
          }}
        />

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 border-t border-gray-100 bg-gray-50/60">
          {LEGEND.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <SessionModal
          session={selectedSession}
          initialDate={selectedDate}
          initialTime={selectedTime}
          onClose={() => { setModalOpen(false); setSelectedSession(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
