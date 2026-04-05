import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import hrLocale from '@fullcalendar/core/locales/hr';
import deLocale from '@fullcalendar/core/locales/de';
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

const LEGEND_KEYS = [
  { key: 'sessions.legend_scheduled', color: '#38bdf8' },
  { key: 'sessions.legend_completed', color: '#22c55e' },
  { key: 'sessions.legend_noshow',    color: '#f87171' },
  { key: 'sessions.legend_cancelled', color: '#cbd5e1' },
];

export default function Calendar() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const fcLocale = i18n.language === 'hr' ? hrLocale : i18n.language === 'de' ? deLocale : undefined;
  const calRef = useRef(null);
  const mobile = window.innerWidth < 640;

  const [currentView, setCurrentView] = useState(mobile ? 'timeGridDay' : 'timeGridWeek');
  const [title,       setTitle]       = useState('');
  const [modalOpen,       setModalOpen]       = useState(false);
  const [selectedSession,  setSelectedSession]  = useState(null);
  const [selectedDate,     setSelectedDate]     = useState(null);
  const [selectedTime,     setSelectedTime]     = useState(null);
  const [selectedEndTime,  setSelectedEndTime]  = useState(null);
  const [groupSession,     setGroupSession]     = useState(null);
  const [groupModalOpen,   setGroupModalOpen]   = useState(false);
  const [clientFilter,     setClientFilter]     = useState('');
  const [clients,          setClients]          = useState([]);

  // FC manages fetch lifecycle — no infinite loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchEvents = useCallback(async (fetchInfo, successCallback, failureCallback) => {
    try {
      const start = format(fetchInfo.start, 'yyyy-MM-dd');
      const end   = format(fetchInfo.end,   'yyyy-MM-dd');
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

      const [indivRes, groupRes] = await Promise.all([
        sessionsAPI.getAll({ startDate: start, endDate: end }),
        fetch(`${API_URL}/groups/sessions/calendar?startDate=${start}&endDate=${end}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()),
      ]);

      const individual = indivRes.data.sessions.map(session => {
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
            kind:        'individual',
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
      });

      const group = (groupRes.sessions || []).map(gs => {
        const dateOnly = gs.session_date.split('T')[0];
        const color    = gs.group_color || '#0ea5e9';
        return {
          id:              `group-${gs.id}`,
          title:           `👥 ${gs.group_name}`,
          start:           `${dateOnly}T${gs.start_time.slice(0, 5)}`,
          end:             `${dateOnly}T${gs.end_time.slice(0, 5)}`,
          backgroundColor: color,
          borderColor:     color,
          textColor:       '#ffffff',
          extendedProps: {
            kind:          'group',
            groupSessionId: gs.id,
            groupId:       gs.group_id,
            groupName:     gs.group_name,
            groupColor:    gs.group_color,
            sessionType:   gs.session_type,
            notes:         gs.notes,
            sessionDate:   dateOnly,
            startTime:     gs.start_time,
            endTime:       gs.end_time,
            memberCount:   gs.member_count,
            status:        gs.status || 'scheduled',
          },
        };
      });

      const filteredIndividual = clientFilter
        ? individual.filter(e => String(e.extendedProps.clientId) === String(clientFilter))
        : individual;
      successCallback([...filteredIndividual, ...group]);
    } catch (e) { failureCallback(e); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    fetch(`${API_URL}/clients?isActive=true`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setClients(d.clients || []))
      .catch(() => {});
  }, [clientFilter]);

  const handleDatesSet   = (arg) => setTitle(arg.view.title);
  const handleSelect = (arg) => {
    setSelectedSession(null);
    setSelectedDate(format(arg.start, 'yyyy-MM-dd'));
    setSelectedTime(arg.start);
    setSelectedEndTime(arg.end);
    setModalOpen(true);
  };
  const handleEventClick = (arg) => {
    const e = arg.event;
    if (e.extendedProps.kind === 'group') {
      setGroupSession(e.extendedProps);
      setGroupModalOpen(true);
      return;
    }
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
    ? [{ id: 'timeGridDay', label: t('calendar.day') }, { id: 'dayGridMonth', label: t('calendar.month') }]
    : [{ id: 'timeGridDay', label: t('calendar.day') }, { id: 'timeGridWeek', label: t('calendar.week') }, { id: 'dayGridMonth', label: t('calendar.month') }];

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('sessions.title')}</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">{t('calendar.clickToCreate')}</p>
        </div>
        <button
          onClick={() => {
            setSelectedSession(null);
            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
            setSelectedTime(new Date());
            setSelectedEndTime(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold text-sm shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span> {t('sessions.newSession').replace('New ', '')}
        </button>
      </div>

      {/* Calendar card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">

          {/* Left: nav buttons */}
          <div className="flex items-center gap-1">
            <button onClick={() => go('prev')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors font-bold text-lg">
              ‹
            </button>
            <button onClick={() => go('today')}
              className="h-8 px-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 transition-colors text-xs font-semibold">
              {t('calendar.today')}
            </button>
            <button onClick={() => go('next')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors font-bold text-lg">
              ›
            </button>
          </div>

          {/* Center: title */}
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:block select-none">{title}</span>

          {/* Center-right: client filter */}
          {clients.length > 0 && (
            <select
              value={clientFilter}
              onChange={e => { setClientFilter(e.target.value); calRef.current?.getApi().refetchEvents(); }}
              className="hidden sm:block text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[160px]"
            >
              <option value="">{t('sessions.allClients')}</option>
              {clients.map(cl => (
                <option key={cl.id} value={cl.id}>{cl.first_name} {cl.last_name}</option>
              ))}
            </select>
          )}

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
          locale={fcLocale}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={3}
          weekends={true}
          events={fetchEvents}
          select={handleSelect}
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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
          {LEGEND_KEYS.map(({ key, color }) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{t(key)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Group session info popup */}
      {groupModalOpen && groupSession && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: groupSession.groupColor || '#0ea5e9' }}>
                  👥
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{groupSession.groupName}</h3>
                  <p className="text-xs text-gray-400">Group Session</p>
                </div>
              </div>
              <button onClick={() => setGroupModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-5">📅</span>
                <span>{new Date(groupSession.sessionDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-5">🕐</span>
                <span>{groupSession.startTime?.slice(0,5)} – {groupSession.endTime?.slice(0,5)}</span>
              </div>
              {groupSession.sessionType && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-5">🏋️</span>
                  <span>{groupSession.sessionType}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-5">👥</span>
                <span>{groupSession.memberCount} member{groupSession.memberCount !== 1 ? 's' : ''}</span>
              </div>
              {groupSession.notes && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-5">📝</span>
                  <span className="text-gray-500 italic">{groupSession.notes}</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => { setGroupModalOpen(false); navigate(`/dashboard/groups/${groupSession.groupId}`); }}
                className="flex-1 btn-secondary text-sm">View Group →</button>
              <button onClick={() => { setGroupModalOpen(false); navigate(`/dashboard/groups/${groupSession.groupId}/sessions/${groupSession.groupSessionId}`); }} className="flex-1 btn-primary text-sm">Open Session →</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <SessionModal
          session={selectedSession}
          initialDate={selectedDate}
          initialTime={selectedTime}
          initialEndTime={selectedEndTime}
          onClose={() => { setModalOpen(false); setSelectedSession(null); setSelectedEndTime(null); }}
          onSave={() => { handleSave(); setSelectedEndTime(null); }}
        />
      )}
    </div>
  );
}
