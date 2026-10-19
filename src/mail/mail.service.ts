import { Injectable } from '@nestjs/common';

export interface NewUserRequestMailData {
  imatricule: string;
  nom: string;
  prenom: string;
  cin: string;
  telephone: string;
  email?: string | null;
  adresse: string;
  role: string;
  soa?: { code: string; libelle: string } | null;
  createdAt?: Date | string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateFr(value?: Date | string): string {
  try {
    return value != null
      ? new Date(value).toLocaleString('fr-FR')
      : new Date().toLocaleString('fr-FR');
  } catch {
    return new Date().toLocaleString('fr-FR');
  }
}

function soaLabelOf(request: NewUserRequestMailData): string {
  return request.soa ? `${request.soa.code} - ${request.soa.libelle}` : '—';
}

function rowHtml(label: string, value: unknown, striped: boolean): string {
  return `
    <tr>
      <td style="padding:10px 16px;font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#8a7a3d;background-color:${striped ? '#faf6e9' : '#ffffff'};width:170px;vertical-align:top;border-bottom:1px solid #eee5c8;">${label}</td>
      <td style="padding:10px 16px;font-size:14px;color:#2b2620;background-color:${striped ? '#faf6e9' : '#ffffff'};vertical-align:top;border-bottom:1px solid #eee5c8;">${escapeHtml(value ?? '—')}</td>
    </tr>`;
}

/** Template HTML professionnel aux couleurs SRB (table-based, 100% inline, sans image). */
export function buildNewUserRequestHtml(
  request: NewUserRequestMailData,
  adminUrl?: string | null,
): string {
  const soaLabel = soaLabelOf(request);
  const dateLabel = formatDateFr(request.createdAt);
  const fullName = `${request.nom} ${request.prenom}`.trim();
  const cta = adminUrl
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td align="center" style="padding:24px 0 8px 0;">
        <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background-color:#a67e22;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:8px;">Examiner la demande</a>
      </td></tr>
      <tr><td align="center" style="padding:0 0 8px 0;font-size:12px;color:#8a7a3d;">
        Espace admin &gt; Demandes : ${escapeHtml(adminUrl)}
      </td></tr>
    </table>`
    : `
    <p style="font-size:14px;color:#2b2620;">Connectez-vous à l’espace admin &gt; Demandes pour approuver ou rejeter cette demande.</p>`;

  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:0;background-color:#f3f0e6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Nouvelle demande de compte — ${escapeHtml(request.imatricule)} (${escapeHtml(fullName)}) à traiter.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f0e6;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e3d5a8;border-radius:12px;overflow:hidden;">
      <tr><td style="background-color:#a67e22;padding:26px 32px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;color:#f7ecc8;">SERVICE RÉGIONAL DES BUDGETS — HAUTE MATSIATRA</p>
        <h1 style="margin:8px 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;color:#ffffff;">Nouvelle demande de création de compte</h1>
        <span style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#a67e22;background-color:#ffffff;padding:5px 14px;border-radius:999px;">À TRAITER</span>
      </td></tr>
      <tr><td style="padding:24px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
        <p style="margin:0 0 6px 0;font-size:15px;color:#2b2620;">Bonjour,</p>
        <p style="margin:0 0 18px 0;font-size:14px;line-height:21px;color:#4d4638;"><strong>${escapeHtml(fullName)}</strong> (${escapeHtml(request.imatricule)}) vient de déposer une demande de compte sur le portail SRB. Voici le récapitulatif :</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #eee5c8;border-radius:8px;overflow:hidden;border-collapse:collapse;">
          ${rowHtml('Matricule', request.imatricule, false)}
          ${rowHtml('Nom', request.nom, true)}
          ${rowHtml('Prénom', request.prenom, false)}
          ${rowHtml('CIN', request.cin, true)}
          ${rowHtml('Téléphone', request.telephone, false)}
          ${rowHtml('Email', request.email ?? '—', true)}
          ${rowHtml('Adresse', request.adresse, false)}
          ${rowHtml('Rôle demandé', request.role, true)}
          ${rowHtml('SOA', soaLabel, false)}
          ${rowHtml('Date demande', dateLabel, true)}
        </table>
        ${cta}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="background-color:#fdf8e8;border:1px solid #eee5c8;border-radius:8px;padding:12px 16px;font-size:13px;line-height:19px;color:#4d4638;">
            Pour contacter le demandeur, répondez directement à cet email${request.email ? ` (<strong>${escapeHtml(request.email)}</strong>)` : ''}.
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 32px 26px 32px;font-family:Arial,Helvetica,sans-serif;background-color:#ffffff;">
        <hr style="border:none;border-top:1px solid #eee5c8;margin:12px 0 14px 0;" />
        <p style="margin:0;font-size:12px;line-height:18px;color:#8a8474;">Email automatique envoyé par le portail SRB Haute Matsiatra. Merci de traiter cette demande dans l’espace admin &gt; Demandes.</p>
        <p style="margin:6px 0 0 0;font-size:12px;color:#8a8474;">© SRB Haute Matsiatra</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Version texte (améliore la délivrabilité / clients sans HTML). */
export function buildNewUserRequestText(
  request: NewUserRequestMailData,
  adminUrl?: string | null,
): string {
  const lines = [
    'SRB HAUTE MATSIATRA — Nouvelle demande de création de compte',
    '',
    'Bonjour,',
    `${request.nom} ${request.prenom} (${request.imatricule}) vient de déposer une demande de compte :`,
    '',
    `Matricule : ${request.imatricule}`,
    `Nom : ${request.nom}`,
    `Prénom : ${request.prenom}`,
    `CIN : ${request.cin}`,
    `Téléphone : ${request.telephone}`,
    `Email demandeur : ${request.email ?? '—'}`,
    `Adresse : ${request.adresse}`,
    `Rôle demandé : ${request.role}`,
    `SOA : ${soaLabelOf(request)}`,
    `Date : ${formatDateFr(request.createdAt)}`,
    '',
  ];
  if (adminUrl) {
    lines.push(`Examiner la demande : ${adminUrl}`, '');
  } else {
    lines.push(
      'Connectez-vous à l’espace admin > Demandes pour approuver ou rejeter.',
      '',
    );
  }
  lines.push(
    'Pour contacter le demandeur, répondez directement à cet email.',
    '— Email automatique du portail SRB Haute Matsiatra',
  );
  return lines.join('\n');
}

export interface PasswordResetMailData {
  email: string;
  nom: string;
  prenom: string;
  /** Jeton en clair : il ne transite QUE par cet email. */
  token: string;
  expiresInMinutes: number;
}

/**
 * Lien de réinitialisation, même charte graphique que la notification
 * de demande (table-based, 100% inline, couleurs SRB).
 */
export function buildPasswordResetHtml(
  data: PasswordResetMailData,
  resetUrl: string | null,
): string {
  const fullName = `${data.nom} ${data.prenom}`.trim();

  const cta = resetUrl
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td align="center" style="padding:24px 0 8px 0;">
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background-color:#a67e22;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:8px;">Choisir mon mot de passe</a>
      </td></tr>
      <tr><td align="center" style="padding:0 0 8px 0;font-size:12px;color:#8a7a3d;">
        Ce lien expire dans ${data.expiresInMinutes} minutes et ne fonctionne qu'une seule fois.
      </td></tr>
    </table>`
    : `
    <p style="font-size:14px;color:#2b2620;">Le lien n'a pas pu être généré. Contactez l'administrateur.</p>`;

  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:0;background-color:#f3f0e6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Réinitialisation du mot de passe SRB pour ${escapeHtml(fullName)}.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f0e6;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e3d5a8;border-radius:12px;overflow:hidden;">
      <tr><td style="background-color:#a67e22;padding:26px 32px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;color:#f7ecc8;">SERVICE RÉGIONAL DES BUDGETS — HAUTE MATSIATRA</p>
        <h1 style="margin:8px 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;color:#ffffff;">Réinitialisation du mot de passe</h1>
        <span style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#a67e22;background-color:#ffffff;padding:5px 14px;border-radius:999px;">SÉCURITÉ DU COMPTE</span>
      </td></tr>
      <tr><td style="padding:24px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
        <p style="margin:0 0 6px 0;font-size:15px;color:#2b2620;">Bonjour,</p>
        <p style="margin:0 0 18px 0;font-size:14px;line-height:21px;color:#4d4638;">Une réinitialisation de mot de passe a été demandée pour le compte de <strong>${escapeHtml(fullName)}</strong> (${escapeHtml(data.email)}).</p>
        ${cta}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="background-color:#fdf8e8;border:1px solid #eee5c8;border-radius:8px;padding:12px 16px;font-size:13px;line-height:19px;color:#4d4638;">
            <strong>Vous n'êtes pas à l'origine de cette demande ?</strong> Ignorez ce message :
            votre mot de passe actuel reste valable et aucune session ne sera fermée.
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 32px 26px 32px;font-family:Arial,Helvetica,sans-serif;background-color:#ffffff;">
        <hr style="border:none;border-top:1px solid #eee5c8;margin:12px 0 14px 0;" />
        <p style="margin:0;font-size:12px;line-height:18px;color:#8a8474;">Email automatique envoyé par le portail SRB Haute Matsiatra.</p>
        <p style="margin:6px 0 0 0;font-size:12px;color:#8a8474;">© SRB Haute Matsiatra</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Version texte (délivrabilité / clients sans HTML). */
export function buildPasswordResetText(
  data: PasswordResetMailData,
  resetUrl: string | null,
): string {
  const fullName = `${data.nom} ${data.prenom}`.trim();
  const lines = [
    'SRB HAUTE MATSIATRA — Réinitialisation du mot de passe',
    '',
    'Bonjour,',
    `Une réinitialisation a été demandée pour ${fullName} (${data.email}).`,
    '',
  ];
  if (resetUrl) {
    lines.push(
      'Pour choisir un nouveau mot de passe :',
      resetUrl,
      '',
      `Ce lien expire dans ${data.expiresInMinutes} minutes et ne fonctionne qu'une seule fois.`,
    );
  } else {
    lines.push(
      "Le lien n'a pas pu être généré. Contactez l'administrateur.",
    );
  }
  lines.push(
    '',
    "Vous n'êtes pas à l'origine de cette demande ? Ignorez ce message :",
    'votre mot de passe actuel reste valable.',
    '— Email automatique du portail SRB Haute Matsiatra',
  );
  return lines.join('\n');
}

/**
 * Envoi d'emails via l'API HTTP Resend (pas de SMTP, pas de dépendance).
 * Ne throw jamais : un échec d'envoi ne doit pas bloquer la création
 * de la demande de compte.
 */
@Injectable()
export class MailService {
  async sendNewUserRequestNotification(
    request: NewUserRequestMailData,
  ): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;
    const from =
      process.env.MAIL_FROM ?? 'SRB Demande <onboarding@resend.dev>';
    const frontendUrl = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
    const adminUrl = frontendUrl ? `${frontendUrl}/user-requests` : null;

    if (!apiKey || !adminEmail) {
      console.warn(
        '[MailService] Envoi ignoré : RESEND_API_KEY ou ADMIN_EMAIL manquant dans .env',
      );
      return;
    }

    const html = buildNewUserRequestHtml(request, adminUrl);
    const text = buildNewUserRequestText(request, adminUrl);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [adminEmail],
          subject: `Demande compte SRB - ${request.nom} ${request.prenom} (${request.imatricule})`,
          ...(request.email ? { reply_to: request.email } : {}),
          html,
          text,
        }),
      });

      if (!res.ok) {
        const details = await res.text().catch(() => '');
        console.warn(
          `[MailService] Échec envoi Resend (${res.status}) : ${details}`,
        );
        return;
      }

      console.log(
        `[MailService] Notification demande compte ${request.imatricule} envoyée à ${adminEmail}`,
      );
    } catch (error) {
      console.warn('[MailService] Erreur envoi email :', error);
    }
  }

  /**
   * Envoi du lien de réinitialisation à l'intéressé.
   *
   * Ne throw jamais : le service appelant doit pouvoir renvoyer la réponse
   * neutre sans se soucier de l'envoi. Le jeton n'apparaît pas dans les
   * logs (il ne l'est de toute façon pas ici : seul le résultat l'est).
   */
  async sendPasswordResetNotification(
    data: PasswordResetMailData,
  ): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM ?? 'SRB Demande <onboarding@resend.dev>';
    const frontendUrl = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
    const resetUrl = frontendUrl
      ? `${frontendUrl}/reinitialiser-mdp?token=${encodeURIComponent(data.token)}`
      : null;

    if (!apiKey) {
      console.warn(
        '[MailService] Réinitialisation ignorée : RESEND_API_KEY manquant dans .env',
      );
      return;
    }

    if (!resetUrl) {
      console.warn(
        '[MailService] Réinitialisation ignorée : FRONTEND_URL manquant dans .env',
      );
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [data.email],
          subject: 'SRB Haute Matsiatra - Réinitialisation de votre mot de passe',
          html: buildPasswordResetHtml(data, resetUrl),
          text: buildPasswordResetText(data, resetUrl),
        }),
      });

      if (!res.ok) {
        const details = await res.text().catch(() => '');
        console.warn(
          `[MailService] Échec envoi Resend (${res.status}) : ${details}`,
        );
        return;
      }

      console.log(
        `[MailService] Lien de réinitialisation envoyé à ${data.email}`,
      );
    } catch (error) {
      console.warn('[MailService] Erreur envoi email :', error);
    }
  }
}
