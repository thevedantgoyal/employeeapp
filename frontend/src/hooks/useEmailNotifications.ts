import { db } from "@/integrations/api/db";

interface EmailData {
  to: string;
  subject: string;
  html: string;
  type?: string;
}

export const sendEmailNotification = async (data: EmailData): Promise<boolean> => {
  try {
    const response = await db.functions.invoke("send-email", {
      body: data,
    });

    if (response.error) {
      console.error("Email notification error:", response.error);
      return false;
    }

    if (response.data?.success === false) {
      console.log("Email not sent:", response.data?.message);
      return false;
    }

    return !!(response.data as { success?: boolean } | null)?.success;
  } catch (error) {
    console.error("Failed to send email notification:", error);
    return false;
  }
};

export const sendTaskAssignedEmail = async (
  email: string,
  taskTitle: string,
  assignerName?: string
): Promise<boolean> => {
  return sendEmailNotification({
    to: email,
    subject: `New Task Assigned: ${taskTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Task Assigned</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            You have been assigned a new task:
          </p>
          <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <h2 style="color: #1e293b; margin: 0; font-size: 18px;">${taskTitle}</h2>
            ${assignerName ? `<p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;">Assigned by ${assignerName}</p>` : ""}
          </div>
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            Log in to your dashboard to view the task details and get started.
          </p>
        </div>
      </div>
    `,
    type: "task_assigned",
  });
};

export const sendContributionApprovedEmail = async (
  email: string,
  contributionTitle: string,
  managerName?: string
): Promise<boolean> => {
  return sendEmailNotification({
    to: email,
    subject: `Contribution Approved: ${contributionTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✓ Contribution Approved</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            Great news! Your contribution has been approved:
          </p>
          <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <h2 style="color: #1e293b; margin: 0; font-size: 18px;">${contributionTitle}</h2>
            ${managerName ? `<p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;">Approved by ${managerName}</p>` : ""}
          </div>
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            Keep up the excellent work!
          </p>
        </div>
      </div>
    `,
    type: "contribution_approved",
  });
};

export const sendContributionRejectedEmail = async (
  email: string,
  contributionTitle: string,
  feedback?: string,
  managerName?: string
): Promise<boolean> => {
  return sendEmailNotification({
    to: email,
    subject: `Changes Requested: ${contributionTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Changes Requested</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            Your contribution requires some changes:
          </p>
          <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <h2 style="color: #1e293b; margin: 0; font-size: 18px;">${contributionTitle}</h2>
            ${managerName ? `<p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;">Reviewed by ${managerName}</p>` : ""}
            ${feedback ? `
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">Feedback:</p>
                <p style="color: #334155; font-size: 14px; margin: 0;">${feedback}</p>
              </div>
            ` : ""}
          </div>
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            Please review the feedback and update your contribution.
          </p>
        </div>
      </div>
    `,
    type: "contribution_rejected",
  });
};

export const sendRoleChangedEmail = async (
  email: string,
  newRole: string
): Promise<boolean> => {
  return sendEmailNotification({
    to: email,
    subject: `Your Role Has Been Updated`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Role Update</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            Your role has been updated:
          </p>
          <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px; text-align: center;">
            <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">New Role</p>
            <h2 style="color: #1e293b; margin: 0; font-size: 24px; text-transform: capitalize;">${newRole.replace("_", " ")}</h2>
          </div>
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            You may have access to new features and permissions. Log in to explore your updated dashboard.
          </p>
        </div>
      </div>
    `,
    type: "role_changed",
  });
};

export const sendTeamAssignedEmail = async (
  email: string,
  teamName: string
): Promise<boolean> => {
  return sendEmailNotification({
    to: email,
    subject: `You've Been Added to Team: ${teamName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Your New Team!</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            You have been added to a team:
          </p>
          <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px; text-align: center;">
            <h2 style="color: #1e293b; margin: 0; font-size: 24px;">${teamName}</h2>
          </div>
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            Log in to connect with your team members and start collaborating!
          </p>
        </div>
      </div>
    `,
    type: "team_assigned",
  });
};
