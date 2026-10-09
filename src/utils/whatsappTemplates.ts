/**
 * WhatsApp Message Templates for Complaint Lifecycle Management
 * All templates are parameterized and standardized for Brihaspathi Technologies.
 */

export const whatsappTemplates = {
  // 1. Complaint Creation
  complaintCreatedCustomer: (params: { customerName: string; ticketId: string }) =>
    `Dear ${params.customerName || "Customer"}, your complaint #${params.ticketId} has been successfully registered. Our team will review and update you shortly. - Brihaspathi Technologies`,

  // 2. Remote Fix Executed (Phase 2)
  remoteFixCustomer: (params: { customerName: string; ticketId: string; happinessCode: string }) =>
    `Dear ${params.customerName || "Customer"}, your complaint #${params.ticketId} has been resolved remotely. Your Happiness Code is: ${params.happinessCode}. Please share this code with our supervisor for verification. - Brihaspathi Technologies`,

  // 3. Field Visit Required / Technicians Assigned (Phase 3)
  fieldVisitCustomer: (params: {
    customerName: string;
    ticketId: string;
    date: string;
    time: string;
    techNames: string;
  }) =>
    `Dear ${params.customerName || "Customer"}, your field visit for complaint #${params.ticketId} is scheduled for ${params.date} at ${params.time}. Technicians: ${params.techNames}. - Brihaspathi Technologies`,

  fieldVisitTechnician: (params: {
    ticketId: string;
    customerName: string;
    date: string;
    time: string;
    location: string;
    teamSize: number;
  }) =>
    `New Job Assigned: Complaint #${params.ticketId} for ${params.customerName}. Scheduled: ${params.date} at ${params.time}. Location: ${params.location || "Customer Site"}. Total team size: ${params.teamSize} tech(s). - Brihaspathi Technologies`,

  // 4. Reassignment / Cancellation (Crucial Edge Case)
  reassignOldTechnician: (params: { ticketId: string; customerName: string }) =>
    `Job Update: Complaint #${params.ticketId} has been cancelled/reassigned. You are no longer required to visit ${params.customerName}. - Brihaspathi Technologies`,

  reassignNewTechnician: (params: {
    ticketId: string;
    customerName: string;
    date: string;
    time: string;
    location: string;
  }) =>
    `New Job Assigned (Reassignment): Complaint #${params.ticketId} for ${params.customerName}. Scheduled: ${params.date} at ${params.time}. Location: ${params.location || "Customer Site"}. - Brihaspathi Technologies`,

  reassignCustomer: (params: {
    customerName: string;
    ticketId: string;
    techNames: string;
    date: string;
    time: string;
  }) =>
    `Update: Your visit for complaint #${params.ticketId} is rescheduled. New Technicians: ${params.techNames}. Scheduled: ${params.date} at ${params.time}. - Brihaspathi Technologies`,

  // 5. Schedule Date/Time Changed by Admin/Supervisor
  scheduleUpdateTechnician: (params: {
    ticketId: string;
    customerName: string;
    date: string;
    time: string;
  }) =>
    `Schedule Update for Complaint #${params.ticketId}: New Date/Time is ${params.date} at ${params.time} for ${params.customerName}. - Brihaspathi Technologies`,

  scheduleUpdateCustomer: (params: {
    customerName: string;
    ticketId: string;
    date: string;
    time: string;
  }) =>
    `Schedule Update: Your visit for complaint #${params.ticketId} is now scheduled for ${params.date} at ${params.time}. - Brihaspathi Technologies`,

  // 6. Technician Starts Journey (Phase 3/4)
  journeyStartedCustomer: (params: {
    customerName: string;
    techName: string;
    ticketId: string;
  }) =>
    `Dear ${params.customerName || "Customer"}, your technician ${params.techName} has started their journey to your location for complaint #${params.ticketId}. - Brihaspathi Technologies`,

  journeyStartedAdmin: (params: {
    techName: string;
    ticketId: string;
    customerName: string;
  }) =>
    `Technician ${params.techName} started journey for complaint #${params.ticketId} (Customer: ${params.customerName}). - Brihaspathi Technologies`,

  // 7. Resolution Submitted & Pending Verification (Phase 5)
  resolutionAdmin: (params: {
    ticketId: string;
    techName: string;
    customerName: string;
  }) =>
    `Resolution submitted for complaint #${params.ticketId} (Customer: ${params.customerName}) by ${params.techName}. Please verify. - Brihaspathi Technologies`,

  resolutionCustomer: (params: {
    customerName: string;
    ticketId: string;
    happinessCode: string;
  }) =>
    `Work completed for complaint #${params.ticketId}! Your Happiness Code is: ${params.happinessCode}. Please share this with our supervisor. - Brihaspathi Technologies`,

  // 8. Verification Done & Ticket Closed (Phase 6)
  ticketClosedCustomer: (params: {
    customerName: string;
    ticketId: string;
  }) =>
    `Dear ${params.customerName || "Customer"}, your complaint #${params.ticketId} has been successfully closed. Thank you for choosing Brihaspathi Technologies!`,

  ticketClosedInvolved: (params: {
    ticketId: string;
    customerName: string;
  }) =>
    `Complaint #${params.ticketId} for ${params.customerName} has been verified and closed. - Brihaspathi Technologies`,
};
