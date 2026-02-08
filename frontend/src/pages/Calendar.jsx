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
  const [error, setError] = useState('');
  const loadedRange = useRef(null);

  useEffect(() => {
    // Load initial sessions
    loadSessions();
  }, []);

  const loadSessions = async (startDate = null, endDate = null) => {
    try {
      const rangeKey = `${startDate}-${endDate}`;
      
      // Prevent duplicate loads
      if (loadedRange.current === rangeKey) {
        console.log('Already loaded this range, skipping');
        return;
      }
      
      setLoading(true);
      setError('');
      
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      console.log('Loading sessions with params:', params);
      const response = await sessionsAPI.getAll(params);
      console.log('Sessions loaded:', response.data.sessions);
      console.log('First session date details:', response.data.sessions[0]?.session_date);
      
      loadedRange.current = rangeKey;
      
      const calendarEvents = response.data.sessions.map(session => {
        // Extract just the date part (YYYY-MM-DD) from session_date
        const dateOnly = session.session_date.split('T')[0];
        console.log('Processing session:', session.id, 'Original date:', session.session_date, 'Extracted:', dateOnly);
        
        return {
          id: session.id,
          title: `${session.client_first_name} ${session.client_last_name}`,
          start: `${dateOnly}T${session.start_time}`,
          end: `${dateOnly}T${session.end_time}`,
          backgroundColor: session.is_completed ? '#10b981' : '#0ea5e9',
          borderColor: session.is_completed ? '#059669' : '#0284c7',
          extendedProps: {
            clientId: session.client_id,
            sessionType: session.session_type,
            notes: session.notes,
            isCompleted: session.is_completed,
            sessionDate: dateOnly,  // Store original date here
            startTime: session.start_time,
            endTime: session.end_time
          },
        };
      });

      setEvents(calendarEvents);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError('Failed to load sessions');
      setLoading(false);
    }
  };

  const handleDateClick = (arg) => {
    console.log('Date clicked:', arg);
    setSelectedSession(null);
    setSelectedDate(arg.dateStr);
    setSelectedTime(arg.date);
    setModalOpen(true);
  };

  const handleEventClick = (arg) => {
    console.log('Event clicked:', arg.event);
    const event = arg.event;
    
    // Use the date stored in extendedProps to avoid timezone issues
    const sessionDate = event.extendedProps.sessionDate;
    const startTime = event.extendedProps.startTime;
    const endTime = event.extendedProps.endTime;
    
    setSelectedSession({
      id: event.id,
      clientId: event.extendedProps.clientId,
      sessionDate: sessionDate,
      startTime: startTime,
      endTime: endTime,
      sessionType: event.extendedProps.sessionType,
      notes: event.extendedProps.notes,
      clientName: event.title,
    });
    setSelectedDate(null);
    setSelectedTime(null);
    setModalOpen(true);
  };

  const handleDatesSet = (arg) => {
    console.log('Dates changed:', arg.start, 'to', arg.end);
    const start = format(arg.start, 'yyyy-MM-dd');
    const end = format(arg.end, 'yyyy-MM-dd');
    loadSessions(start, end);
  };

  const handleSaveSession = () => {
    setModalOpen(false);
    // Clear the loaded range so it reloads
    loadedRange.current = null;
    loadSessions();
  };

  if (error) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Schedule</h1>
        </div>
        <div className="card">
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
          <button onClick={() => {
            loadedRange.current = null;
            loadSessions();
          }} className="btn-primary mt-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

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
            timeZone="local"
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
