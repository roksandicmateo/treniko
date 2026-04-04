# apply_translations.ps1
# Run from the treniko\ project root:
#   powershell -ExecutionPolicy Bypass -File apply_translations.ps1

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendSrc = Join-Path $ProjectRoot "frontend\src"
$LocalesDir  = Join-Path $FrontendSrc "locales"
$Downloads   = "$env:USERPROFILE\Downloads"

Write-Host ""
Write-Host "Treniko i18n Auto-Patcher" -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy JSON files
Write-Host "Step 1: Copying translation JSON files..." -ForegroundColor Yellow

if (!(Test-Path $LocalesDir)) { New-Item -ItemType Directory -Path $LocalesDir | Out-Null }

foreach ($lang in @("en", "hr", "de")) {
    $src  = Join-Path $Downloads "$lang.json"
    $dest = Join-Path $LocalesDir "$lang.json"
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dest -Force
        Write-Host "  OK $lang.json copied" -ForegroundColor Green
    } elseif (Test-Path $dest) {
        Write-Host "  OK $lang.json already in locales" -ForegroundColor Green
    } else {
        Write-Host "  WARN $lang.json not found in Downloads" -ForegroundColor Red
    }
}

# Step 2: Replacements
Write-Host ""
Write-Host "Step 2: Patching source files..." -ForegroundColor Yellow

$replacements = @(
    @{ O = ">Loading...</";                    N = ">{t('common.loading')}</" },
    @{ O = ">Saving...</";                     N = ">{t('common.saving')}</" },
    @{ O = "'Saving...'";                      N = "t('common.saving')" },
    @{ O = ">Cancel</";                        N = ">{t('common.cancel')}</" },
    @{ O = ">Save</";                          N = ">{t('common.save')}</" },
    @{ O = ">Edit</";                          N = ">{t('common.edit')}</" },
    @{ O = ">Delete</";                        N = ">{t('common.delete')}</" },
    @{ O = ">Confirm</";                       N = ">{t('common.confirm')}</" },
    @{ O = ">Close</";                         N = ">{t('common.close')}</" },
    @{ O = ">Add</";                           N = ">{t('common.add')}</" },
    @{ O = ">Yes</";                           N = ">{t('common.yes')}</" },
    @{ O = ">No</";                            N = ">{t('common.no')}</" },
    @{ O = ">Done</";                          N = ">{t('common.done')}</" },
    @{ O = "'Loading...'";                     N = "t('common.loading')" },
    @{ O = '"History"';                        N = "t('common.history')" },
    @{ O = '"Notes"';                          N = "t('common.notes')" },
    @{ O = '"Date"';                           N = "t('common.date')" },
    @{ O = '"Amount"';                         N = "t('common.amount')" },
    @{ O = '"Actions"';                        N = "t('common.actions')" },
    @{ O = '"Duration"';                       N = "t('common.duration')" },
    @{ O = ">Log In</";                        N = ">{t('auth.login')}</" },
    @{ O = ">Log Out</";                       N = ">{t('auth.logout')}</" },
    @{ O = ">Sign in</";                       N = ">{t('auth.signIn')}</" },
    @{ O = ">Sign up</";                       N = ">{t('auth.signUp')}</" },
    @{ O = "'Logging in...'";                  N = "t('auth.loggingIn')" },
    @{ O = "'Creating account...'";            N = "t('auth.registering')" },
    @{ O = ">Welcome back</";                  N = ">{t('auth.welcome')}</" },
    @{ O = "label: 'Dashboard'";              N = "label: t('nav.dashboard')" },
    @{ O = "label: 'Calendar'";               N = "label: t('nav.calendar')" },
    @{ O = "label: 'Trainings'";              N = "label: t('nav.trainings')" },
    @{ O = "label: 'Exercises'";              N = "label: t('nav.exercises')" },
    @{ O = "label: 'Clients'";                N = "label: t('nav.clients')" },
    @{ O = "label: 'Groups'";                 N = "label: t('nav.groups')" },
    @{ O = "label: 'Packages'";               N = "label: t('nav.packages')" },
    @{ O = "label: 'Home'";                   N = "label: t('nav.home')" },
    @{ O = ">Active Clients</";               N = ">{t('dashboard.activeClients')}</" },
    @{ O = ">Sessions Today</";               N = ">{t('dashboard.sessionsToday')}</" },
    @{ O = ">Completed This Month</";         N = ">{t('dashboard.completedThisMonth')}</" },
    @{ O = ">Active Packages</";              N = ">{t('dashboard.activePackages')}</" },
    @{ O = ">Today's Sessions</";             N = ">{t('dashboard.todaySessions')}</" },
    @{ O = ">Package Alerts</";               N = ">{t('dashboard.packageAlerts')}</" },
    @{ O = ">Recent Clients</";               N = ">{t('dashboard.recentClients')}</" },
    @{ O = "'No sessions scheduled for today'"; N = "t('dashboard.noSessionsToday')" },
    @{ O = "'Schedule a session'";            N = "t('dashboard.scheduleSession')" },
    @{ O = "'No upcoming sessions this week'"; N = "t('dashboard.noUpcomingSessions')" },
    @{ O = "'All packages are healthy'";      N = "t('dashboard.allPackagesHealthy')" },
    @{ O = "'Expires today'";                 N = "t('dashboard.expiresToday')" },
    @{ O = ">Add Client</";                   N = ">{t('clients.addClient')}</" },
    @{ O = '"Add Client"';                    N = "t('clients.addClient')" },
    @{ O = '"Edit Profile"';                  N = "t('clients.editProfile')" },
    @{ O = 'placeholder="Search clients..."'; N = "placeholder={t('clients.searchClients')}" },
    @{ O = '"No clients yet"';                N = "t('clients.noClients')" },
    @{ O = '"Add your first client"';         N = "t('clients.addFirstClient')" },
    @{ O = '"First Name *"';                  N = "t('clients.firstName')" },
    @{ O = '"Last Name *"';                   N = "t('clients.lastName')" },
    @{ O = '"Date of Birth"';                 N = "t('clients.dateOfBirth')" },
    @{ O = '"Deactivate"';                    N = "t('clients.deactivate')" },
    @{ O = '"Reactivate"';                    N = "t('clients.reactivate')" },
    @{ O = '"Archive"';                       N = "t('clients.archive')" },
    @{ O = '"Archived"';                      N = "t('clients.archived')" },
    @{ O = '"No trainings yet"';              N = "t('trainings.noTrainings')" },
    @{ O = '"+ Add First Training"';          N = "t('trainings.addFirstTraining')" },
    @{ O = ">Mark Done</";                    N = ">{t('trainings.markDone')}</" },
    @{ O = "'Done'";                          N = "t('trainings.completed')" },
    @{ O = "'Sched.'";                        N = "t('trainings.scheduled')" },
    @{ O = '"No exercises logged"';           N = "t('trainings.detail.noExercises')" },
    @{ O = '"Total Sets"';                    N = "t('trainings.fields.totalSets')" },
    @{ O = '"Active Package"';                N = "t('packages.activePackage')" },
    @{ O = '"No active package"';             N = "t('packages.noActivePackage')" },
    @{ O = '"+ Assign Package"';              N = "t('packages.assignPackage')" },
    @{ O = '"Assign a Package"';              N = "t('packages.assignFirst')" },
    @{ O = '"Cancel package"';                N = "t('packages.cancelPackage')" },
    @{ O = '"Cancel this package?"';          N = "t('packages.confirmCancel')" },
    @{ O = '"Log Payment"';                   N = "t('billing.logPayment')" },
    @{ O = '"Edit Payment"';                  N = "t('billing.editPayment')" },
    @{ O = '"Total Paid"';                    N = "t('billing.summary.totalPaid')" },
    @{ O = '"Pending"';                       N = "t('billing.summary.pending')" },
    @{ O = '"Total Revenue"';                 N = "t('billing.summary.totalRevenue')" },
    @{ O = '"No payments logged yet."';       N = "t('billing.noPayments')" },
    @{ O = '"Log the first payment"';         N = "t('billing.logFirstPayment')" },
    @{ O = '"Method"';                        N = "t('billing.table.method')" },
    @{ O = '"Package"';                       N = "t('billing.table.package')" },
    @{ O = '"Note"';                          N = "t('billing.table.note')" },
    @{ O = '"Cash"';                          N = "t('billing.method.cash')" },
    @{ O = '"Bank Transfer"';                 N = "t('billing.method.bank_transfer')" },
    @{ O = '"Card"';                          N = "t('billing.method.card')" },
    @{ O = '"Other"';                         N = "t('billing.method.other')" },
    @{ O = '"Body Metrics"';                  N = "t('progress.bodyMetrics')" },
    @{ O = '"No strength data yet"';          N = "t('progress.noStrengthData')" },
    @{ O = '"Add Entry"';                     N = "t('progress.addEntry')" },
    @{ O = "'Loading strength data...'";      N = "t('common.loading')" },
    @{ O = '"No groups yet"';                 N = "t('groups.noGroups')" },
    @{ O = '"Members"';                       N = "t('groups.members')" },
    @{ O = '"Present"';                       N = "t('groups.attendance.present')" },
    @{ O = '"Absent"';                        N = "t('groups.attendance.absent')" },
    @{ O = '"Mark All Present"';              N = "t('groups.attendance.markAll')" },
    @{ O = '"Save Attendance"';               N = "t('groups.attendance.save')" },
    @{ O = '"Current Plan"';                  N = "t('subscription.currentPlan')" },
    @{ O = '"Upgrade"';                       N = "t('subscription.upgrade')" },
    @{ O = '"Downgrade"';                     N = "t('subscription.downgrade')" },
    @{ O = '"Monthly"';                       N = "t('subscription.monthly')" },
    @{ O = '"Yearly"';                        N = "t('subscription.yearly')" },
    @{ O = '"Billing Period"';                N = "t('subscription.billingPeriod')" },
    @{ O = '"Limit Reached"';                 N = "t('subscription.limits.limitReached')" },
    @{ O = '"Language"';                      N = "t('profile.language')" },
    @{ O = '"Dark Mode"';                     N = "t('profile.darkMode')" },
    @{ O = '"Light Mode"';                    N = "t('profile.lightMode')" },
    @{ O = '"Save Changes"';                  N = "t('profile.saveChanges')" },
    @{ O = '"Export My Data"';                N = "t('profile.exportData')" },
    @{ O = '"Delete Account"';                N = "t('profile.deleteAccount')" },
    @{ O = '"Danger Zone"';                   N = "t('profile.dangerZone')" },
    @{ O = '"English"';                       N = "t('profile.languages.en')" },
    @{ O = '"Croatian"';                      N = "t('profile.languages.hr')" },
    @{ O = '"German"';                        N = "t('profile.languages.de')" },
    @{ O = '"All clients"';                   N = "t('calendar.allClients')" }
)

$importLine = "import { useTranslation } from 'react-i18next';"
$hookLine   = "  const { t } = useTranslation();"

$changedFiles = @()
$skippedCount = 0

$files = Get-ChildItem -Path $FrontendSrc -Recurse -Include "*.jsx","*.js" |
    Where-Object { $_.FullName -notmatch "node_modules|locales|api\.js|Service\.js|service\.js" }

foreach ($file in $files) {
    $original = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $content  = $original

    foreach ($r in $replacements) {
        if ($content.Contains($r.O) -and (-not $content.Contains($r.N))) {
            $content = $content.Replace($r.O, $r.N)
        }
    }

    if ($content.Contains("t('") -and (-not $content.Contains("useTranslation"))) {
        $lines = $content -split "`n"
        $lastImportIdx = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i].TrimStart().StartsWith("import ")) { $lastImportIdx = $i }
        }
        if ($lastImportIdx -ge 0) {
            $linesList = [System.Collections.Generic.List[string]]$lines
            $linesList.Insert($lastImportIdx + 1, $importLine)
            $content = $linesList -join "`n"
        }
    }

    if ($content.Contains("t('") -and (-not $content.Contains("useTranslation()"))) {
        $patterns = @(
            'export default function \w+[^{]*\{',
            'export function \w+[^{]*\{',
            'function \w+[^{]*\{'
        )
        foreach ($pat in $patterns) {
            $m = [regex]::Match($content, $pat)
            if ($m.Success) {
                $insertAt = $m.Index + $m.Length
                $content = $content.Substring(0, $insertAt) + "`n$hookLine" + $content.Substring($insertAt)
                break
            }
        }
    }

    if ($content -ne $original) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        $changedFiles += $file.FullName.Replace($ProjectRoot + "\", "")
    } else {
        $skippedCount++
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "  $($changedFiles.Count) file(s) patched:" -ForegroundColor Green
foreach ($f in $changedFiles) { Write-Host "    - $f" -ForegroundColor White }
Write-Host "  $skippedCount file(s) unchanged" -ForegroundColor Gray
Write-Host ""
Write-Host "Review changes with:  git diff frontend/src" -ForegroundColor Cyan
Write-Host ""
