import os
import re

from setuptools import find_packages, setup

import admin_tools_stats


def read(*parts):
    return open(os.path.join(os.path.dirname(__file__), *parts)).read()


def parse_requirements(file_name):
    requirements = []
    for line in open(file_name, "r").read().split("\n"):
        if re.match(r"(\s*#)|(\s*$)", line):
            continue
        if re.match(r"\s*-e\s+", line):
            requirements.append(re.sub(r"\s*-e\s+.*#egg=(.*)$", r"\1", line))
        elif re.match(r"(\s*git)|(\s*hg)", line):
            pass
        else:
            requirements.append(line)
    return requirements


setup(
    name="django-admin-charts",
    version=admin_tools_stats.__version__,
    description="django-admin-charts - Easily configurable charts statistics for "
    "`django-admin` and `django-admin-tools`",
    long_description=read("README.rst"),
    long_description_content_type="text/x-rst",
    author="Petr Dlouhy",
    author_email="petr.dlouhy@email.cz",
    url="https://github.com/PetrDlouhy/django-admin-charts",
    include_package_data=True,
    zip_safe=False,
    package_dir={"admin_tools_stats": "admin_tools_stats"},
    packages=find_packages(exclude=["demoproject", "demoproject.*"]),
    package_data={},
    python_requires=">=3.10",
    install_requires=parse_requirements("requirements.txt"),
    extras_require={
        # javascript libraries installed with bower instead of the CDN defaults
        "bower": ["django-bower"],
    },
    license="MIT License",
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Environment :: Web Environment",
        "Framework :: Django",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "Programming Language :: Python :: 3.14",
        "Framework :: Django :: 5.2",
        "Framework :: Django :: 6.0",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
)
