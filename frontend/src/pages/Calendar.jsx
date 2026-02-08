import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { sessionsAPI } from '../services/api';
import SessionModal from '../components/SessionModal';
import { format } from 'date-fns';

const Calendar = () => {
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadedRanges = useRef(new Set());

  const loadSessions = async (startDate, endDate) => {
    const rangeKey = `${startDate}-${endDate}`;
    
    // Prevent duplicate loads
    if (loadedRanges.current.has(rangeKey)) {
      return;
    }
    
    try {
      setLoading(true);
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await sessionsAPI.getAll(params);
      
      loadedRanges.current.add(rangeKey);
      
      const calendarEvents = response.data.sessions.map(session => ({
        id: session.id,
        title: `${session.client_first_name} ${session.client_last_name}`,
        start: `${session.session_date}T${session.start_time}`,
        end: `${session.session_date}T${session.end_time}`,
        extendedProps: {
          clientId: session.client_id,
          sessionType: session.session_type,
          notes: session.notes,
        },
      }));

      setEvents(calendarEvents);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (arg) => {
    setSelectedSession(null);
    setSelectedDate(arg.dateStr);
    setSelectedTime(arg.date);
    setModalOpen(true);
  };

  const handleEventClick = (arg) => {
    const event = arg.event;
    setSelectedSession({
      id: event.id,
      clientId: event.extendedProps.clientId,
      sessionDate: format(event.start, 'yyyy-MM-dd'),
      startTime: format(event.start, 'HH:mm'),
      endTime: format(event.end, 'HH:mm'),
      sessionType: event.extendedProps.sessionType,
      notes: event.extendedProps.notes,
      clientName: event.title,
    });
    setSelectedDate(null);
    setSelectedTime(null);
    setModalOpen(true);
  };

  const handleDatesSet = (arg) => {
    const start = format(arg.start, 'yyyy-MM-dd');
    const end = format(arg.end, 'yyyy-MM-dd');
    loadSessions(start, end);
  };

  const handleSaveSession = () => {
    setModalOpen(false);
    loadedRanges.current.clear();
    setEvents([]);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Schedule</h1>
        <p className="text-gray-600 mt-2">Click on a time slot to create a session, or click on an existing session to edit it</p>
      </div>

      <div className="card">
        {loading && events.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Loading calendar...</div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            editable={false}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            events={events}
            select={handleDateClick}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="auto"
            eventColor="#0ea5e9"
          />
        )}
      </div>

      {modalOpen && (
        <SessionModal
          session={selectedSession}
          initialDate={selectedDate}
          initialTime={selectedTime}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveSession}
        />
      )}
    </div>
  );
};

export default Calendar;
