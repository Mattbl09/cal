import { LightningElement, wire } from 'lwc';

import FullCalendarJS from '@salesforce/resourceUrl/Fullcalendar';
import FullCalendarCustom from '@salesforce/resourceUrl/FullCalendarCustom';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { NavigationMixin } from 'lightning/navigation';
import { encodeDefaultFieldValues } from 'lightning/pageReferenceUtils';

import getAllMeetingsData from '@salesforce/apex/AppointmentSchedulerController.getAllMeetingsData';
import getAgentsByTerritory from '@salesforce/apex/AppointmentSchedulerController.getAgentsByTerritory';
import getServiceAgents from '@salesforce/apex/AppointmentSchedulerController.getServiceAgents';
import getServiceTerritory from '@salesforce/apex/AppointmentSchedulerController.getServiceTerritory';
import userId from '@salesforce/user/Id';
import getUserInfo from '@salesforce/apex/AppointmentSchedulerController.getUserInfo';

export default class CustomCalendar extends NavigationMixin(LightningElement) {
  selectedAgentOwnerId = {};

  serviceAgentOptions = [];

  userInfo = [];

  selectedTerritoryId;

  territoryOptions = [];

  territoryTimezone = [];

  selectedTerritory = {};

  isTerritorySelected = false;

  userId = userId;

  lastSelectedServiceAgentId = null;

  dataToRefresh;

  selectedServiceAgentId;

  calendar;

  calendarTitle;

  objectApiName = 'Event';

  objectLabel = '';

  eventsList = [];

  viewOptions = [
    {
      label: 'Day',
      viewName: 'timeGridDay',
      checked: false,
    },
    {
      label: 'Week',
      viewName: 'timeGridWeek',
      checked: true,
    },
  ];

  connectedCallback() {
    Promise.all([
      loadStyle(this, `${FullCalendarJS}/lib/main.css`),
      loadScript(this, `${FullCalendarJS}/lib/main.js`),
      loadStyle(this, FullCalendarCustom),
    ])
      .then(() => {
        this.loadMeetings();
        this.initializeCalendar();
      })
      .catch(error => console.log(error));
  }

  loadMeetings() {
    getAllMeetingsData({ serviceAgentId: this.selectedServiceAgentId })
      .then(result => {
        if (result) {
          this.eventsList = result.map(meeting => ({
            id: meeting.Id,
            editable: true,
            allDay: false,
            start: meeting.StartDateTime,
            end: meeting.EndDateTime,
            title: meeting.Subject,
          }));
          this.refreshCalendar();
        }
      })
      .catch(error => {
        console.error('Error fetching meetings:', error);
      });
  }

  loadServiceAgents() {
    if (this.selectedTerritoryId) {
      getAgentsByTerritory({ territoryId: this.selectedTerritoryId })
        .then(result => {
          if (result) {
            this.serviceAgentOptions = result.map(agent => ({
              label: agent.Assigned_Service_Agent__r.Name,
              value: agent.Assigned_Service_Agent__c,
              OwnerId: agent.Assigned_Service_Agent__r.OwnerId,
              timeZone:
                agent.Appointment_Territory__r.Operating_Hours__r.TimeZone,
            }));
          }
        })
        .catch(error => {
          console.error('Error fetching service agents:', error);
        });
    } else {
      this.serviceAgentOptions = [];
    }
  }

  @wire(getUserInfo, { userId: '$userId' })
  wiredUserInfo({ error, data }) {
    if (data) {
      this.userInfo = {
        label: data.TimeZoneSidKey,
        value: data.Id,
      };
      this.selectedTerritory = {
        timeZoneLabel: data.TimeZoneSidKey,
      };
    } else if (error) {
      console.error('Error fetching user information:', error);
    }
  }

  @wire(getServiceAgents)
  wiredServiceAgents({ error, data }) {
    if (data) {
      this.serviceAgentOptions = data.map(record => ({
        label: record.Name,
        value: record.Id,
      }));
    } else if (error) {
      console.error('Error fetching service agents:', error);
    }
  }

  @wire(getServiceTerritory)
  wiredTerritories({ error, data }) {
    if (data) {
      this.territoryOptions = data.map(record => ({
        label: record.Name,
        value: record.Id,
        timeZone: record.Operating_Hours__r.TimeZone,
        timeZoneLabel: record.Operating_Hours__r.Name,
      }));
    } else if (error) {
      console.error('Error fetching territories:', error);
    }
  }

  calendarActionsHandler(event) {
    const actionName = event.target.value;
    console.log('actionName-->', actionName);
    if (actionName === 'previous') {
      this.calendar.prev();
    } else if (actionName === 'next') {
      this.calendar.next();
    } else if (actionName === 'today') {
      this.calendar.today();
    } else if (actionName === 'new') {
      this.createNewEvent(this.objectApiName);
    } else if (actionName === 'refresh') {
      this.refreshHandler();
    } else if (event.target.name === 'serviceResourcePicklist') {
      const selectedValue = event.detail.value;
      const selectedAgentOwner = this.serviceAgentOptions.find(
        option => option.value === selectedValue
      );
      this.selectedAgentOwnerId = {
        id: selectedValue,
        OwnerId: selectedAgentOwner,
      };
      this.selectedServiceAgentId = event.detail.value;
      this.lastSelectedServiceAgentId = this.selectedServiceAgentId;
      this.refreshHandler();
    } else if (event.target.name === 'territoryPicklist') {
      const selectedValue = event.detail.value;
      const selectedTerritoryOptions = this.territoryOptions.find(
        option => option.value === selectedValue
      );
      this.selectedTerritory = {
        id: selectedValue,
        label: selectedTerritoryOptions.label,
        timeZone: selectedTerritoryOptions.timeZone,
        timeZoneLabel: selectedTerritoryOptions.timeZoneLabel,
      };
      this.selectedTerritoryId = event.detail.value;
      const isTerritorySelected = !!selectedValue; // Check if a territory is selected
      this.isTerritorySelected = isTerritorySelected;
      this.loadServiceAgents();
      this.refreshHandler();
    }
    this.calendarTitle = this.calendar.view.title;
  }

  createNewEvent(objectName, defaultValues) {
    if (!defaultValues) {
      defaultValues = '';
    }
    //Passing Default field values is not supported on mobile.
    if (!this.isMobileDevice()) {
      this[NavigationMixin.Navigate]({
        type: 'standard__objectPage',
        attributes: {
          objectApiName: objectName,
          actionName: 'new',
        },
        state: {
          defaultFieldValues: defaultValues,
          navigationLocation: 'RELATED_LIST',
          recordTypeId: '012VD0000006oLV',
        },
      });
    } else {
      this[NavigationMixin.Navigate]({
        type: 'standard__objectPage',
        attributes: {
          objectApiName: objectName,
          actionName: 'new',
        },
      });
    }
  }

  showMeetingDetails(event) {
    this[NavigationMixin.Navigate]({
      type: 'standard__recordPage',
      attributes: {
        recordId: event.id,
        actionName: 'view',
      },
      state: {
        navigationLocation: 'RELATED_LIST',
      },
    });
  }

  isMobileDevice() {
    const userAgent = window.navigator.userAgent;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    );
  }

  refreshCalendar() {
    if (this.calendar) {
      this.calendar.removeAllEvents();
      this.calendar.addEventSource(this.eventsList);
      this.calendar.refetchEvents();
    }
  }

  refreshHandler() {
    let selectedServiceAgentId = this.selectedServiceAgentId;
    if (!selectedServiceAgentId && this.lastSelectedServiceAgentId) {
      selectedServiceAgentId = this.lastSelectedServiceAgentId;
    }
    getAllMeetingsData({ serviceAgentId: selectedServiceAgentId })
      .then(result => {
        if (result) {
          this.eventsList = result.map(meeting => ({
            id: meeting.Id,
            editable: true,
            allDay: false,
            start: meeting.StartDateTime,
            end: meeting.EndDateTime,
            title: meeting.Subject,
          }));
          this.refreshCalendar();
        }
      })
      .catch(error => {
        console.error('Error fetching meetings:', error);
      });
  }

  initializeCalendar() {
    const calendarEl = this.template.querySelector('div.fullcalendar');
    const copyOfOuterThis = this;
    // eslint-disable-next-line no-undef
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'timeGridWeek',
      headerToolbar: false,
      initialDate: new Date(),
      timeZone: 'UTC',
      showNonCurrentDates: false,
      fixedWeekCount: false,
      allDaySlot: false,
      navLinks: false,
      events: copyOfOuterThis.eventsList,
      eventDisplay: 'block',
      eventColor: '#f36e83',
      eventTimeFormat: {
        hour: 'numeric',
        minute: '2-digit',
        omitZeroMinute: true,
        meridiem: 'short',
      },
      dayMaxEventRows: true,
      eventTextColor: 'rgb(3, 45, 96)',
      dateClick(info) {
        const agentId = copyOfOuterThis.selectedServiceAgentId
          ? copyOfOuterThis.selectedServiceAgentId
          : null; // need to set current usesr if non selected
        const agentOwnerId =
          Object.keys(copyOfOuterThis.selectedAgentOwnerId).length !== 0
            ? copyOfOuterThis.selectedAgentOwnerId.OwnerId.OwnerId
            : copyOfOuterThis.userInfo.value;
        const selectedTerritory = copyOfOuterThis.selectedTerritory
          ? copyOfOuterThis.selectedTerritory
          : null;
        const startDate = new Date(
          info.date.setMinutes(
            info.date.getMinutes() +
              info.date.getTimezoneOffset('America/Los_Angeles')
          )
        );
        const endDate = new Date(startDate.getTime());
        const defaultValues = encodeDefaultFieldValues({
          Name: info.text,
          StartDateTime: startDate.toISOString(),
          EndDateTime: endDate.toISOString(),
          WhatId: agentId,
          Appointment_Time_Zone__c: selectedTerritory.timeZoneLabel,
          OwnerId: agentOwnerId,
        });
        copyOfOuterThis.createNewEvent(
          copyOfOuterThis.objectApiName,
          defaultValues
        );
      },
      eventClick(info) {
        copyOfOuterThis.showMeetingDetails(info.event);
      },
    });
    calendar.render();
    calendar.setOption('contentHeight', 550);
    this.calendarTitle = calendar.view.title;
    this.calendar = calendar;
  }
}