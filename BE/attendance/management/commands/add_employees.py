from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from attendance.models import Employee
import pandas as pd
from django.core.exceptions import ValidationError
import sys

class Command(BaseCommand):
    help = 'Add multiple employees from Excel file'

    def add_arguments(self, parser):
        parser.add_argument('excel_file', type=str, help='Path to the Excel file containing employee data')

    def handle(self, *args, **options):
        try:
            # Read Excel file
            excel_file = options['excel_file']
            df = pd.read_excel(excel_file)

            # Validate required columns
            required_columns = ['Name', 'Email Ids']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                self.stdout.write(
                    self.style.ERROR(
                        f'Missing required columns: {", ".join(missing_columns)}'
                    )
                )
                sys.exit(1)

            for index, row in df.iterrows():
                try:
                    # Get name and email from columns
                    full_name = str(row['Name']).strip()
                    email = str(row['Email Ids']).strip().lower()

                    if not email or not '@' in email:
                        raise ValidationError(f'Invalid email format: {email}')

                    # Create username from email (remove @innovatorstech.com)
                    username = email.split('@')[0]

                    # Split full name into first and last name
                    name_parts = full_name.split(maxsplit=1)
                    first_name = name_parts[0]
                    last_name = name_parts[1] if len(name_parts) > 1 else ''

                    # Check if user already exists
                    if User.objects.filter(username=username).exists():
                        self.stdout.write(
                            self.style.WARNING(
                                f'Employee already exists: {full_name} ({email})'
                            )
                        )
                        continue

                    # Create User
                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        password='employee123',
                        first_name=first_name,
                        last_name=last_name,
                        is_staff=False,
                        is_active=True
                    )

                    # Create Employee
                    employee = Employee.objects.create(
                        user=user,
                        email=email,
                        status='offline'  # Default status
                    )

                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Successfully created employee: {full_name} ({email})'
                        )
                    )

                except ValidationError as ve:
                    self.stdout.write(
                        self.style.ERROR(
                            f'Validation error for {full_name} ({email}): {str(ve)}'
                        )
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'Failed to create employee {full_name} ({email}): {str(e)}'
                        )
                    )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(
                    f'Failed to process Excel file: {str(e)}'
                )
            )
            sys.exit(1)